import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { matchTrainingTemplate } from '../domain/templateMatcher.js'
import { generatePlan } from '../services/ai/planGenerator.js'

const router = Router()

function json(value, fallback = {}) {
  return JSON.stringify(value === undefined || value === null ? fallback : value)
}

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value
  try { return value ? JSON.parse(value) : fallback } catch { return fallback }
}

function toSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  const match = String(value || '').match(/(\d+)\D+(\d{1,2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function sessionType(value) {
  if (value === 'aerobic' || value === 'recovery') return 'easy'
  if (['easy', 'long', 'tempo', 'interval', 'race', 'strength', 'rest'].includes(value)) return value
  return 'easy'
}

function sessionStatus(value) {
  return value === 'done' || value === 'skipped' || value === 'replaced' ? value : 'pending'
}

function roundToFiveMinutes(seconds) {
  return Math.round(seconds / (5 * 60)) * (5 * 60)
}

function buildGoalRecommendation(profile) {
  if (profile.acceptGoalWarning) return null
  const targetTime = Number(profile.targetTime)
  if (!Number.isFinite(targetTime) || targetTime <= 0) return null

  const weeklyKm = Number(profile.weeklyKm) || 0
  const longestRunKm = Number(profile.longestRunKm) || 0
  const runsPerWeek = Number(profile.runsPerWeek) || 0
  const availableDays = Number(profile.availableDays) || 0
  const currentEstimate = Number(profile.best10kPace) > 0
    ? Number(profile.best10kPace) * 10
    : Number(profile.easyPace) > 0
      ? Number(profile.easyPace) * 10
      : null
  if (!currentEstimate || targetTime >= currentEstimate) return null

  // 先看目标差距，再看训练基础。训练基础决定 8 周周期内可以给出的阶段性进步空间。
  const goalGap = (currentEstimate - targetTime) / currentEstimate
  if (goalGap < 0.1) return null
  const baseScore = Math.min(1, weeklyKm / 30) * 0.35
    + Math.min(1, longestRunKm / 12) * 0.25
    + Math.min(1, runsPerWeek / 4) * 0.2
    + Math.min(1, availableDays / 4) * 0.2
  const improvementRate = Math.min(0.12, Math.max(0.05, 0.05 + baseScore * 0.07))
  const attainableTarget = currentEstimate * (1 - improvementRate)
  const suggestedTargetTime = Math.min(
    currentEstimate - 5 * 60,
    Math.max(45 * 60, roundToFiveMinutes(attainableTarget)),
  )
  if (suggestedTargetTime <= targetTime || suggestedTargetTime >= currentEstimate) return null
  const baseDescription = baseScore < 0.45 ? '当前训练基础还在建立阶段' : baseScore < 0.7 ? '当前训练基础可以支持稳步提升' : '当前训练基础较稳定，可以安排适度进步'
  return {
    suggestedTargetTime,
    suggestedTargetPace: Math.round(suggestedTargetTime / 10),
    reason: `当前最好成绩约为${Math.round(currentEstimate / 60)}分钟，目标快了${Math.round(goalGap * 100)}%；${baseDescription}，本周期先安排约${Math.round(improvementRate * 100)}%的阶段性提升更合适。`,
  }
}

async function persistGeneratedPlan(userId, plan, template) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    await connection.execute(
      `INSERT INTO training_template (
        id, name, target_distance, duration_weeks, sessions_per_week, version, content, source_refs, is_active
      ) VALUES (?, ?, '10K', ?, ?, 'ai-plan-v1', ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name), duration_weeks = VALUES(duration_weeks),
        sessions_per_week = VALUES(sessions_per_week), content = VALUES(content),
        source_refs = VALUES(source_refs), is_active = 1`,
      [
        template.id,
        template.name,
        Number(template.durationWeeks || 8),
        Number(template.sessionsPerWeek || 3),
        json({ volumePolicy: template.volumePolicy, blueprint: template.blueprint }),
        json(template.sourceRefs, []),
      ],
    )

    // 新计划生成后，旧的草稿/待确认/执行中计划不再作为当前计划。
    await connection.execute(
      `UPDATE training_plan
       SET status = 'cancelled'
       WHERE user_id = ? AND status IN ('draft', 'pending_confirm', 'active', 'paused')`,
      [userId],
    )

    const weeks = Array.isArray(plan.weeks) ? plan.weeks : []
    const totalTargetKm = Number(
      plan.totalKm ?? weeks.reduce((sum, week) => sum + Number(week.totalKm ?? week.targetKm ?? 0), 0),
    ) || 0
    const targetTimeSec = Number(plan.goalTotalSec || 0) || null
    const goalPaceSec = toSeconds(plan.goalPace)
    const weeklySessions = Number(weeks[0]?.sessions?.length || template.sessionsPerWeek || 0) || null
    const adaptationSummary = typeof plan.adaptationSummary === 'string'
      ? plan.adaptationSummary
      : JSON.stringify(plan.adaptationSummary || '')

    const [planResult] = await connection.execute(
      `INSERT INTO training_plan (
        user_id, template_id, goal_pace_sec, target_time_sec, status, start_date,
        current_week, total_weeks, weekly_sessions, total_target_km, adaptation_summary, generated_by
      ) VALUES (?, ?, ?, ?, 'pending_confirm', ?, ?, ?, ?, ?, ?, 'ai')`,
      [
        userId,
        template.id,
        goalPaceSec,
        targetTimeSec,
        plan.startDate || new Date().toISOString().slice(0, 10),
        Number(plan.currentWeek || 1),
        Number(plan.totalWeeks || 8),
        weeklySessions,
        totalTargetKm,
        adaptationSummary,
      ],
    )
    const planId = planResult.insertId

    for (const [weekIndex, week] of weeks.entries()) {
      const weekNo = Number(week.week || weekIndex + 1)
      const [weekResult] = await connection.execute(
        `INSERT INTO plan_week (
          plan_id, week_no, phase, phase_name, focus, target_km,
          intensity_distribution, is_step_back, is_taper, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          planId,
          weekNo,
          week.phase || 'base',
          week.phaseName || week.phase || '训练阶段',
          week.focus || '',
          Number(week.targetKm ?? week.totalKm ?? 0),
          json(week.intensityDistribution || plan.zoneDistribution || {}),
          week.stepBack ? 1 : 0,
          week.taper ? 1 : 0,
          weekNo === 1 ? 'unlocked' : 'locked',
        ],
      )
      const weekId = weekResult.insertId

      for (const [sessionIndex, session] of (week.sessions || []).entries()) {
        const intensity = typeof session.intensity === 'object' ? session.intensity : {}
        const rpe = Array.isArray(intensity.rpe) ? intensity.rpe : []
        await connection.execute(
          `INSERT INTO plan_session (
            plan_id, week_id, week_no, day_offset, seq, type, title, description,
            structure, target_distance_km, target_duration_min, pace_low_sec, pace_high_sec,
            rpe_low, rpe_high, warmup, cooldown, exercises, adaptation_note, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            weekId,
            weekNo,
            Number(session.dayOffset ?? sessionIndex * 2),
            sessionIndex + 1,
            sessionType(session.type),
            session.title || '训练课次',
            session.description || '',
            json({ ...(session.structure || {}), mainRun: session.mainRun || null }),
            Number(session.distanceKm || 0),
            Number(session.durationMin || 0),
            Number(intensity.paceLow || session.paceLow || 0) || null,
            Number(intensity.paceHigh || session.paceHigh || 0) || null,
            Number(rpe[0] || session.rpeLow || 0) || null,
            Number(rpe[1] || session.rpeHigh || 0) || null,
            json(session.preRunWarmup?.exercises || session.warmup, []),
            json(session.postRunStretch?.exercises || session.cooldown, []),
            json(session.exercises, []),
            session.adaptationNote || '',
            sessionStatus(session.status),
          ],
        )
      }
    }

    await connection.commit()
    return planId
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

function aiErrorMessage(error) {
  if (error.code === 'AI_NOT_CONFIGURED') return 'AI 服务尚未配置，请先配置模型服务'
  if (error.code === 'AI_TIMEOUT') return 'AI 计划生成超时，请稍后重试'
  if (error.code === 'AI_PROVIDER_UNAVAILABLE') return 'AI 服务当前无法连接，请检查后端网络后重试'
  if (error.code === 'AI_PROVIDER_HTTP') return `AI 服务返回异常（${error.status}），请稍后重试`
  if (error.code === 'AI_OUTPUT_PARSE') return 'AI 返回内容无法识别，请稍后重试'
  if (error.code === 'AI_OUTPUT_INVALID') return 'AI 生成的训练计划未通过安全校验'
  return 'AI 计划生成失败，请稍后重试'
}

async function runPlanTask(taskId, userId, profile) {
  try {
    await pool.execute('UPDATE ai_plan_task SET status = \'running\', progress = 10 WHERE id = ? AND user_id = ?', [taskId, userId])
    const template = matchTrainingTemplate(profile)
    const plan = await generatePlan({ profile, template })
    await pool.execute('UPDATE ai_plan_task SET progress = 85 WHERE id = ? AND user_id = ?', [taskId, userId])
    const planId = await persistGeneratedPlan(userId, plan, template)
    await pool.execute(
      `UPDATE ai_plan_task SET status = 'succeeded', progress = 100, result = ?, finished_at = CURRENT_TIMESTAMP(3)
       WHERE id = ? AND user_id = ?`,
      [json({ status: 'completed', plan, template, planId }), taskId, userId],
    )
  } catch (error) {
    console.error('[ai-plan-task]', error)
    await pool.execute(
      `UPDATE ai_plan_task SET status = 'failed', progress = 100, error_message = ?, finished_at = CURRENT_TIMESTAMP(3)
       WHERE id = ? AND user_id = ?`,
      [aiErrorMessage(error), taskId, userId],
    )
  }
}

function profileFromRow(row) {
  const screening = row.screening_result || {}
  return {
    gender: row.gender,
    birthYear: row.birth_year,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    runsPerWeek: Number(row.runs_per_week),
    weeklyKm: Number(row.weekly_km),
    longestRunKm: Number(row.longest_run_km),
    best10kPace: row.best_10k_pace_sec,
    easyPace: row.easy_pace_sec,
    targetDistance: row.target_distance,
    targetType: row.target_type,
    targetTime: row.target_time_sec,
    targetPace: row.target_pace_sec,
    availableDays: Number(row.available_days),
    availableMin: Number(row.available_min),
    terrain: row.terrain || [],
    injuries: row.injury_flags || [],
    screening: screening.answers || {},
    riskLevel: screening.riskLevel || 'low',
  }
}

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM runner_profile WHERE user_id = ? LIMIT 1', [req.auth.sub])
    const storedProfile = rows[0] ? profileFromRow(rows[0]) : null
    const profile = req.body?.profile || storedProfile
    if (!profile) return res.status(409).json({ status: 'blocked', message: '请先完成跑者档案' })
    if (profile.targetDistance !== '10K' && profile.targetDistance !== '10km') {
      return res.status(400).json({ status: 'blocked', message: '当前仅支持 10 公里目标' })
    }
    if (profile.riskLevel === 'medical_confirm' || profile.screening?.riskLevel === 'medical_confirm') {
      return res.status(409).json({ status: 'blocked', message: '当前风险筛查需要医疗确认，请先完成安全确认' })
    }
    const goalRecommendation = buildGoalRecommendation(profile)
    if (goalRecommendation) {
      return res.json({ status: 'goal_adjustment_recommended', goalRecommendation })
    }
    const template = req.body?.template || matchTrainingTemplate(profile)
    const plan = await generatePlan({ profile, template })
    const planId = await persistGeneratedPlan(req.auth.sub, plan, template)
    return res.json({ status: 'completed', plan, template, planId })
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') return res.status(503).json({ status: 'failed', message: 'AI 服务尚未配置，请先配置模型服务' })
    if (error.code === 'AI_TIMEOUT') return res.status(504).json({ status: 'failed', message: 'AI 计划生成超时，请稍后重试' })
    if (error.code === 'AI_PROVIDER_UNAVAILABLE') return res.status(503).json({ status: 'failed', message: 'AI 服务当前无法连接，请检查后端网络后重试' })
    if (error.code === 'AI_PROVIDER_HTTP') return res.status(502).json({ status: 'failed', message: `AI 服务返回异常（${error.status}），请稍后重试` })
    if (error.code === 'AI_OUTPUT_PARSE') return res.status(502).json({ status: 'failed', message: 'AI 返回内容无法识别，请稍后重试' })
    if (error.code === 'AI_OUTPUT_INVALID') return res.status(422).json({ status: 'failed', message: error.message, details: error.details })
    return next(error)
  }
})

router.post('/generate-async', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM runner_profile WHERE user_id = ? LIMIT 1', [req.auth.sub])
    const storedProfile = rows[0] ? profileFromRow(rows[0]) : null
    const profile = req.body?.profile || storedProfile
    if (!profile) return res.status(409).json({ status: 'blocked', message: '请先完成跑者档案' })
    if (profile.targetDistance !== '10K' && profile.targetDistance !== '10km') {
      return res.status(400).json({ status: 'blocked', message: '当前仅支持 10 公里目标' })
    }
    if (profile.riskLevel === 'medical_confirm' || profile.screening?.riskLevel === 'medical_confirm') {
      return res.status(409).json({ status: 'blocked', message: '当前风险筛查需要医疗确认，请先完成安全确认' })
    }
    const goalRecommendation = buildGoalRecommendation(profile)
    if (goalRecommendation) return res.json({ status: 'goal_adjustment_recommended', goalRecommendation })
    const [result] = await pool.execute(
      `INSERT INTO ai_plan_task (user_id, profile, status, progress) VALUES (?, ?, 'queued', 5)`,
      [req.auth.sub, json(profile)],
    )
    const taskId = Number(result.insertId)
    setImmediate(() => runPlanTask(taskId, req.auth.sub, profile))
    return res.status(202).json({ status: 'queued', taskId })
  } catch (error) {
    return next(error)
  }
})

router.get('/tasks/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, status, progress, result, error_message, created_at, updated_at, finished_at FROM ai_plan_task WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.auth.sub],
    )
    const task = rows[0]
    if (!task) return res.status(404).json({ message: '计划生成任务不存在' })
    const result = task.result && typeof task.result === 'object' ? task.result : parseJson(task.result, null)
    return res.json({
      taskId: Number(task.id),
      status: task.status,
      progress: Number(task.progress || 0),
      result,
      error: task.error_message || null,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      finishedAt: task.finished_at,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/goal-recommendation', requireAuth, (req, res) => {
  const profile = req.body?.profile || {}
  const goalRecommendation = buildGoalRecommendation(profile)
  return res.json({ goalRecommendation })
})

export default router
