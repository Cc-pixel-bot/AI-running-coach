import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { generateWithProvider } from '../services/ai/provider.js'

const router = Router()

function json(value, fallback = {}) {
  return JSON.stringify(value === undefined || value === null ? fallback : value)
}

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value
  try { return value ? JSON.parse(value) : fallback } catch { return fallback }
}

function sessionKey(row) {
  return `w${row.week_no}s${row.seq}`
}

function compactText(value, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function mapTrainingType(value) {
  if (value === 'aerobic' || value === 'recovery') return 'easy'
  return value
}

function sanitizeAdjustments(adjustments, futureSessions, context) {
  const futureById = new Map(futureSessions.map((item) => [item.sessionId, item]))
  const allowedTypes = new Set(['easy', 'long', 'tempo', 'interval', 'race', 'strength', 'rest'])
  const maxDuration = Math.max(15, Number(context.available_min || 180))
  const maxDistance = Math.max(
    1,
    Number(context.longest30dKm || context.longest_run_km || 0) * 1.1,
    Number(context.target_distance_km || 0) * 1.25,
  )
  return adjustments
    .filter((item) => futureById.has(item?.target?.sessionId))
    .slice(0, 3)
    .map((item) => {
      const original = futureById.get(item.target.sessionId)
      const after = item.after || {}
      const normalizedType = mapTrainingType(after.type)
      const distanceKm = Number(after.distanceKm)
      const durationMin = Number(after.durationMin)
      const safeAfter = {}
      if (allowedTypes.has(normalizedType)) safeAfter.type = normalizedType
      const finalType = safeAfter.type || original.type
      if (finalType === 'rest') {
        safeAfter.distanceKm = 0
      } else if (Number.isFinite(distanceKm) && distanceKm > 0 && distanceKm <= maxDistance) {
        safeAfter.distanceKm = Math.round(distanceKm * 10) / 10
      } else {
        safeAfter.distanceKm = Number(original.distanceKm || 0)
      }
      safeAfter.durationMin = Number.isFinite(durationMin) && durationMin > 0 && durationMin <= maxDuration
        ? Math.round(durationMin)
        : Number(original.durationMin || 0)
      const title = compactText(after.title, 120)
      const description = compactText(after.description, 500)
      const adaptationNote = compactText(after.adaptationNote, 500)
      if (title) safeAfter.title = title
      if (description) safeAfter.description = description
      if (adaptationNote) safeAfter.adaptationNote = adaptationNote
      return {
        id: compactText(item.id, 80) || `adj_${item.target.sessionId}`,
        type: 'MODIFY_SESSION',
        target: { sessionId: item.target.sessionId },
        before: {
          type: original.type,
          distanceKm: Number(original.distanceKm || 0),
          durationMin: Number(original.durationMin || 0),
        },
        after: safeAfter,
        reasonCode: compactText(item.reasonCode, 80) || 'AI_ADJUSTMENT',
        reasonText: compactText(item.reasonText, 500) || '根据本次训练表现调整后续训练负荷。',
      }
    })
}

async function getContext(userId, recordId) {
  const [rows] = await pool.execute(
    `SELECT sr.*, sr.id AS record_id, ps.id AS db_session_id, ps.week_no, ps.seq, ps.type, ps.title,
            ps.description, ps.structure, ps.target_distance_km, ps.target_duration_min,
            ps.pace_low_sec, ps.pace_high_sec, ps.adaptation_note,
            ps.rpe_low, ps.rpe_high,
            tf.completion, tf.actual_distance_km, tf.actual_duration_min, tf.rpe,
            tf.feel, tf.pain_score, tf.pain_parts, tf.note,
            tp.id AS plan_id, tp.current_week, tp.total_weeks, tp.total_target_km, tp.adaptation_summary,
            pw.phase, pw.phase_name, pw.focus, pw.target_km AS week_target_km,
            pw.is_step_back, pw.is_taper,
            rp.*
     FROM session_record sr
     JOIN plan_session ps ON ps.id = sr.session_id
     JOIN training_plan tp ON tp.id = sr.plan_id
     JOIN plan_week pw ON pw.id = ps.week_id
     LEFT JOIN training_feedback tf ON tf.record_id = sr.id
     LEFT JOIN runner_profile rp ON rp.user_id = sr.user_id
     WHERE sr.id = ? AND sr.user_id = ? LIMIT 1`,
    [recordId, userId],
  )
  return rows[0] || null
}

function detectAdjustmentTriggers(context, trainingContext) {
  const reasons = []
  const completion = context.completion
  const rpe = context.rpe === null || context.rpe === undefined ? null : Number(context.rpe)
  const targetRpe = Number(context.rpe_high || context.rpe_low || 0)
  const painScore = Number(context.pain_score || 0)
  const note = String(context.note || '')
  const recent = trainingContext.recentSessions

  if (completion && completion !== 'full') reasons.push('INCOMPLETE_SESSION')
  if (rpe !== null && targetRpe && rpe >= targetRpe + 2) reasons.push('HIGH_RPE')
  if (['fatigued', 'very_hard'].includes(context.feel)) reasons.push('FATIGUE_FEEDBACK')
  if (painScore >= 4) reasons.push('PAIN_FEEDBACK')
  if (/(疼|痛|紧|刺|麻|头晕|胸闷|喘|不敢发力|不舒服|睡眠|失眠|疲劳|太累|撑不住)/i.test(note)) {
    reasons.push('RISK_NOTE')
  }
  if (trainingContext.load7d.incompleteSessions >= 2) reasons.push('REPEATED_INCOMPLETE')
  if (trainingContext.load7d.painSessions >= 2) reasons.push('REPEATED_PAIN')
  if (recent.filter((item) => item.painScore >= 4).length >= 2) reasons.push('RECENT_PAIN_TREND')
  if (recent.filter((item) => ['fatigued', 'very_hard'].includes(item.feel)).length >= 2) reasons.push('RECENT_FATIGUE_TREND')
  if (trainingContext.previousAdjustments.some((item) => item.decision === 'accepted' && item.reviewDueForSessionId === sessionKey(context))) {
    reasons.push('ADJUSTMENT_REVIEW_DUE')
  }

  return { triggered: reasons.length > 0, reasons: [...new Set(reasons)] }
}

function stablePlanResponse(context, triggerReasons = []) {
  return {
    adjustmentId: null,
    triggered: false,
    decision: 'keep',
    scope: 'none',
    triggerReasons,
    source: 'system',
    adjustments: [],
    safetyNotice: null,
    summary: '本次训练状态与当前计划匹配，继续执行原计划。',
  }
}

async function getRecentTrainingContext(userId, planId, recordId) {
  const [recentResult, gpsResult, decisionResult] = await Promise.all([
    pool.execute(
      `SELECT sr.id, sr.started_at, sr.ended_at, sr.status, sr.duration_sec, sr.distance_km,
              sr.avg_pace_sec, sr.pause_count, ps.week_no, ps.seq, ps.type, ps.title,
              tf.completion, tf.actual_distance_km, tf.actual_duration_min, tf.rpe,
              tf.feel, tf.pain_score, tf.pain_parts, tf.note
       FROM session_record sr
       JOIN plan_session ps ON ps.id = sr.session_id
       LEFT JOIN training_feedback tf ON tf.record_id = sr.id
       WHERE sr.user_id = ? AND sr.id <= ?
       ORDER BY COALESCE(sr.ended_at, sr.created_at) DESC
       LIMIT 12`,
      [userId, recordId],
    ),
    pool.execute(
      `SELECT gt.sample_count, COUNT(gp.id) AS stored_points,
              SUM(CASE WHEN gp.is_valid = 1 THEN 1 ELSE 0 END) AS valid_points,
              AVG(CASE WHEN gp.is_valid = 1 THEN gp.accuracy_m ELSE NULL END) AS avg_accuracy_m
       FROM gps_track gt
       LEFT JOIN gps_point gp ON gp.track_id = gt.id
       WHERE gt.record_id = ?
       GROUP BY gt.id, gt.sample_count`,
      [recordId],
    ),
    pool.execute(
      `SELECT reason_codes, after_state, user_decision, created_at
       FROM adjustment_log
       WHERE user_id = ? AND plan_id = ?
       ORDER BY created_at DESC LIMIT 3`,
      [userId, planId],
    ),
  ])

  const recentRows = recentResult[0]
  const now = Date.now()
  const summarizeWindow = (days) => {
    const cutoff = now - days * 864e5
    const rows = recentRows.filter((row) => {
      const time = new Date(row.ended_at || row.started_at || 0).getTime()
      return Number.isFinite(time) && time >= cutoff
    })
    const feedbackRows = rows.filter((row) => row.rpe !== null)
    return {
      sessions: rows.length,
      distanceKm: Math.round(rows.reduce((sum, row) => sum + Number(row.actual_distance_km ?? row.distance_km ?? 0), 0) * 10) / 10,
      durationMin: Math.round(rows.reduce((sum, row) => sum + Number(row.actual_duration_min ?? Number(row.duration_sec || 0) / 60), 0)),
      avgRpe: feedbackRows.length
        ? Math.round((feedbackRows.reduce((sum, row) => sum + Number(row.rpe || 0), 0) / feedbackRows.length) * 10) / 10
        : null,
      incompleteSessions: rows.filter((row) => row.completion && row.completion !== 'full').length,
      painSessions: rows.filter((row) => Number(row.pain_score || 0) >= 4).length,
    }
  }

  const recentSessions = recentRows.slice(0, 6).map((row) => ({
    sessionId: sessionKey(row),
    date: row.ended_at || row.started_at,
    type: row.type,
    plannedTitle: row.title,
    status: row.status,
    distanceKm: Number(row.actual_distance_km ?? row.distance_km ?? 0),
    durationMin: Number(row.actual_duration_min ?? Number(row.duration_sec || 0) / 60),
    avgPace: Number(row.avg_pace_sec || 0),
    completion: row.completion,
    rpe: row.rpe === null ? null : Number(row.rpe),
    feel: row.feel,
    painScore: Number(row.pain_score || 0),
    painParts: parseJson(row.pain_parts, []),
    note: compactText(row.note, 200),
  }))

  const gpsRow = gpsResult[0][0]
  const storedPoints = Number(gpsRow?.stored_points || 0)
  const validPoints = Number(gpsRow?.valid_points || 0)
  const gpsQuality = {
    sampleCount: Number(gpsRow?.sample_count || 0),
    storedPoints,
    validPoints,
    validRatio: storedPoints ? Math.round((validPoints / storedPoints) * 100) / 100 : null,
    avgAccuracyM: gpsRow?.avg_accuracy_m === null || gpsRow?.avg_accuracy_m === undefined
      ? null
      : Math.round(Number(gpsRow.avg_accuracy_m) * 10) / 10,
  }

  return {
    load7d: summarizeWindow(7),
    load28d: summarizeWindow(28),
    longest30dKm: Math.max(...recentRows
      .filter((row) => new Date(row.ended_at || row.started_at || 0).getTime() >= now - 30 * 864e5)
      .map((row) => Number(row.actual_distance_km ?? row.distance_km ?? 0)), 0),
    recentSessions,
    gpsQuality,
    previousAdjustments: decisionResult[0].map((row) => {
      const afterState = parseJson(row.after_state, {})
      return {
        reasonCodes: parseJson(row.reason_codes, []),
        decision: row.user_decision,
        createdAt: row.created_at,
        reviewDueForSessionId: afterState.followUp?.nextReviewAfterSessionId
          || afterState.adjustmentEpisode?.reviewAfterSessionId
          || null,
      }
    }),
  }
}

function buildPrompts(context, futureSessions, trainingContext) {
  const currentSession = {
    id: sessionKey(context),
    week: Number(context.week_no),
    type: context.type,
    title: context.title,
    description: context.description,
    distanceKm: Number(context.target_distance_km || 0),
    durationMin: Number(context.target_duration_min || 0),
    pace: [context.pace_low_sec, context.pace_high_sec],
  }
  const actual = {
    distanceKm: Number(context.distance_km || 0),
    durationSec: Number(context.duration_sec || 0),
    avgPace: Number(context.avg_pace_sec || 0),
    bestPace: Number(context.best_pace_sec || 0),
    pauseCount: Number(context.pause_count || 0),
  }
  const feedback = {
    completion: context.completion,
    actualDistanceKm: context.actual_distance_km === null ? null : Number(context.actual_distance_km),
    actualDurationMin: context.actual_duration_min === null ? null : Number(context.actual_duration_min),
    rpe: context.rpe === null ? null : Number(context.rpe),
    feel: context.feel,
    painScore: Number(context.pain_score || 0),
    painParts: parseJson(context.pain_parts, []),
    note: context.note || '',
  }
  const runnerProfile = {
    runsPerWeek: context.runs_per_week,
    weeklyKm: Number(context.weekly_km || 0),
    longestRunKm: Number(context.longest_run_km || 0),
    easyPaceSec: context.easy_pace_sec,
    targetDistance: context.target_distance,
    targetTimeSec: context.target_time_sec,
    targetDate: context.target_date,
    availableDays: context.available_days,
    availableMin: context.available_min,
    injuryFlags: parseJson(context.injury_flags, []),
    screeningResult: parseJson(context.screening_result, {}),
    terrain: parseJson(context.terrain, []),
  }
  const planContext = {
    currentWeek: Number(context.current_week || context.week_no),
    totalWeeks: Number(context.total_weeks),
    phase: context.phase,
    phaseName: context.phase_name,
    focus: context.focus,
    weekTargetKm: Number(context.week_target_km || 0),
    isStepBack: Boolean(context.is_step_back),
    isTaper: Boolean(context.is_taper),
    adaptationSummary: context.adaptation_summary,
  }
  const system = `你是智程，负责根据真实训练数据动态调整10公里训练计划。请综合上下文做出判断。
只返回 JSON，不要解释，不提供诊断。你只能修改后续未完成课次，并尽量少改动。
判断优先级：
1. 安全：疼痛评分、疼痛部位、异常主观描述、既往伤病与筛查结果。
2. 恢复：完成度、RPE、疲劳感、连续课次反应及近7天/28天负荷。
3. 计划连续性：当前训练阶段、本周目标、回撤/减量状态和前后课次衔接。
4. 可执行性：用户每次可用时长、场地、最长跑能力和GPS数据可信度。
5. 用户偏好：过去调整是否被接受；不要反复提出已被拒绝且没有新安全证据的同类调整。
GPS有效点不足或精度差时，降低对距离和配速的置信度，优先参考时长、RPE和反馈。
最多调整未来3节课；只返回确实需要变动的课次。
如果本次需要连续降低两节课，第三节安排一节过渡训练，观察用户能否恢复原训练阶段；过渡课之后的质量课等待下一次反馈确认后再恢复。
没有充分理由时允许返回空 adjustments，不要为了体现智能而强行改计划。`
  const user = `请分析本次训练并调整后续计划。

跑者档案：${JSON.stringify(runnerProfile)}
当前计划阶段：${JSON.stringify(planContext)}
本次原定课次：${JSON.stringify(currentSession)}
实际训练数据：${JSON.stringify(actual)}
用户反馈：${JSON.stringify(feedback)}
近期训练负荷：${JSON.stringify({ load7d: trainingContext.load7d, load28d: trainingContext.load28d, longest30dKm: trainingContext.longest30dKm })}
最近课次（从新到旧）：${JSON.stringify(trainingContext.recentSessions)}
本次GPS质量：${JSON.stringify(trainingContext.gpsQuality)}
过往AI调整及用户决定：${JSON.stringify(trainingContext.previousAdjustments)}
后续未完成课次：${JSON.stringify(futureSessions)}

只返回以下结构：
{
  "decision": "keep | adjust | need_more_info",
  "scope": "none | micro",
  "adjustmentEpisode": {
    "hypothesis": "调整假设",
    "reviewAfterSessionId": "w2s2",
    "restoreCondition": "恢复条件",
    "holdCondition": "继续低负荷的条件"
  },
  "adjustments": [
    {
      "id": "adj_1",
      "type": "MODIFY_SESSION",
      "target": {"sessionId": "w2s1"},
      "before": {"distanceKm": 6, "durationMin": 40},
      "after": {"distanceKm": 5, "durationMin": 34, "type": "easy", "title": "轻松恢复跑", "description": "", "adaptationNote": ""},
      "reasonCode": "PAIN_RECOVERY|FATIGUE_REDUCE|INCOMPLETE_RECOVERY|LOAD_CONTROL|SCHEDULE_ADAPT",
      "reasonText": "调整原因"
    }
  ],
  "followUp": {
    "nextAction": "bridge_then_resume",
    "nextReviewAfterSessionId": "w2s2"
  },
  "safetyNotice": null,
  "summary": "本次训练总结"
}`
  return { system, user }
}

router.post('/adjust', requireAuth, async (req, res, next) => {
  try {
    const context = await getContext(req.auth.sub, req.body?.recordId)
    if (!context) return res.status(404).json({ message: '训练记录或反馈不存在' })
    const trainingContext = await getRecentTrainingContext(req.auth.sub, context.plan_id, context.record_id)
    const trigger = detectAdjustmentTriggers(context, trainingContext)
    if (!trigger.triggered && req.body?.force !== true) {
      return res.json(stablePlanResponse(context, trigger.reasons))
    }
    const [futureRows] = await pool.execute(
      `SELECT ps.week_no, ps.seq, ps.type, ps.title, ps.description,
              ps.target_distance_km AS distanceKm, ps.target_duration_min AS durationMin,
              ps.pace_low_sec AS paceLow, ps.pace_high_sec AS paceHigh
       FROM plan_session ps
       WHERE ps.plan_id = ? AND (ps.week_no > ? OR (ps.week_no = ? AND ps.seq > ?))
         AND ps.status = 'pending'
       ORDER BY ps.week_no, ps.seq LIMIT 6`,
      [context.plan_id, context.week_no, context.week_no, context.seq],
    )
    const futureSessions = futureRows.map((row) => ({ ...row, sessionId: sessionKey(row) }))
    context.longest30dKm = trainingContext.longest30dKm
    const prompts = buildPrompts(context, futureSessions, trainingContext)
    const result = await generateWithProvider({
      system: prompts.system,
      user: prompts.user,
      maxTokens: 1000,
      timeoutMs: 30000,
    })
    const adjustments = Array.isArray(result?.adjustments) ? result.adjustments : []
    const allowed = new Set(futureSessions.map((item) => item.sessionId))
    const safeAdjustments = sanitizeAdjustments(
      adjustments.filter((item) => allowed.has(item?.target?.sessionId)),
      futureSessions,
      context,
    )
    const defaultReviewSessionId = safeAdjustments[1]?.target?.sessionId
      || safeAdjustments[0]?.target?.sessionId
      || null
    const reviewAfterSessionId = allowed.has(result?.adjustmentEpisode?.reviewAfterSessionId)
      ? result.adjustmentEpisode.reviewAfterSessionId
      : defaultReviewSessionId
    const nextReviewAfterSessionId = allowed.has(result?.followUp?.nextReviewAfterSessionId)
      ? result.followUp.nextReviewAfterSessionId
      : reviewAfterSessionId
    const adjustmentEpisode = result?.adjustmentEpisode && typeof result.adjustmentEpisode === 'object'
      ? {
          hypothesis: compactText(result.adjustmentEpisode.hypothesis, 500),
          reviewAfterSessionId,
          restoreCondition: compactText(result.adjustmentEpisode.restoreCondition, 500),
          holdCondition: compactText(result.adjustmentEpisode.holdCondition, 500),
        }
      : null
    const followUp = result?.followUp && typeof result.followUp === 'object'
      ? {
          nextAction: compactText(result.followUp.nextAction, 80),
          nextReviewAfterSessionId,
        }
      : (nextReviewAfterSessionId ? { nextAction: 'review', nextReviewAfterSessionId } : null)
    const decision = safeAdjustments.length
      ? 'adjust'
      : (['keep', 'need_more_info'].includes(result?.decision) ? result.decision : 'keep')
    const allowedScopes = new Set(['none', 'micro'])
    const scope = safeAdjustments.length
      ? (allowedScopes.has(result?.scope) ? result.scope : 'micro')
      : 'none'
    const initialDecision = safeAdjustments.length ? 'pending' : 'accepted'
    const [insert] = await pool.execute(
      `INSERT INTO adjustment_log (
        user_id, plan_id, record_id, before_state, after_state, adjustment_set, reason_codes, user_decision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.auth.sub,
        context.plan_id,
        context.record_id,
        json({
          sessionId: sessionKey(context),
          feedback: { painScore: context.pain_score, painParts: parseJson(context.pain_parts, []), rpe: context.rpe, feel: context.feel },
          triggerReasons: trigger.reasons,
          load7d: trainingContext.load7d,
          load28d: trainingContext.load28d,
          gpsQuality: trainingContext.gpsQuality,
        }),
        json({
          decision,
          scope,
          adjustmentEpisode,
          followUp,
          adjustments: safeAdjustments,
        }),
        json(safeAdjustments, []),
        json(safeAdjustments.map((item) => item.reasonCode).filter(Boolean), []),
        initialDecision,
      ],
    )
    const summary = result?.summary || '已根据本次训练表现分析后续安排。'
    await pool.execute(
      `INSERT INTO ai_summary (record_id, user_id, content, facts_snapshot, model_name)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content), facts_snapshot = VALUES(facts_snapshot), model_name = VALUES(model_name)`,
      [
        context.record_id,
        req.auth.sub,
        summary,
        json({
          safetyNotice: result?.safetyNotice || null,
          triggerReasons: trigger.reasons,
          decision,
          scope,
          adjustmentEpisode,
          followUp,
          adjustments: safeAdjustments,
          load7d: trainingContext.load7d,
          load28d: trainingContext.load28d,
          gpsQuality: trainingContext.gpsQuality,
        }),
        process.env.AI_MODEL || null,
      ],
    )
    return res.json({
      adjustmentId: safeAdjustments.length ? Number(insert.insertId) : null,
      triggered: true,
      source: 'ai',
      decision,
      scope,
      triggerReasons: trigger.reasons,
      adjustmentEpisode,
      followUp,
      adjustments: safeAdjustments,
      safetyNotice: result?.safetyNotice || null,
      summary,
    })
  } catch (error) {
    if (error.code === 'AI_PROVIDER_HTTP' || error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_TIMEOUT') {
      return res.status(503).json({ message: 'AI 暂时无法完成训练调整，请稍后重试' })
    }
    return next(error)
  }
})

router.post('/adjust/:id/decision', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const decision = req.body?.decision === 'accepted' ? 'accepted' : 'rejected'
    const [logs] = await connection.execute(
      'SELECT * FROM adjustment_log WHERE id = ? AND user_id = ? AND user_decision = \'pending\' LIMIT 1',
      [req.params.id, req.auth.sub],
    )
    const log = logs[0]
    if (!log) return res.status(404).json({ message: '调整记录不存在或已处理' })
    await connection.beginTransaction()
    if (decision === 'accepted') {
      const adjustmentSet = parseJson(log.adjustment_set, [])
      for (const item of adjustmentSet) {
        const target = String(item?.target?.sessionId || '').match(/^w(\d+)s(\d+)$/i)
        if (!target) continue
        const after = item.after || {}
        await connection.execute(
          `UPDATE plan_session SET type = COALESCE(?, type), title = COALESCE(?, title),
             description = COALESCE(?, description), structure = COALESCE(?, structure),
             target_distance_km = COALESCE(?, target_distance_km), target_duration_min = COALESCE(?, target_duration_min),
             pace_low_sec = COALESCE(?, pace_low_sec), pace_high_sec = COALESCE(?, pace_high_sec),
             adaptation_note = COALESCE(?, adaptation_note), status = 'replaced'
           WHERE plan_id = ? AND week_no = ? AND seq = ?`,
          [
            after.type || null, after.title || null, after.description || null,
            json(after.structure, null), Number.isFinite(Number(after.distanceKm)) ? Number(after.distanceKm) : null,
            Number.isFinite(Number(after.durationMin)) ? Number(after.durationMin) : null,
            Number.isFinite(Number(after.paceLow)) ? Number(after.paceLow) : null,
            Number.isFinite(Number(after.paceHigh)) ? Number(after.paceHigh) : null,
            after.adaptationNote || null, log.plan_id, Number(target[1]), Number(target[2]),
          ],
        )
      }
      const [planRows] = await connection.execute(
        'SELECT current_week, total_weeks FROM training_plan WHERE id = ? AND user_id = ? LIMIT 1',
        [log.plan_id, req.auth.sub],
      )
      const planState = planRows[0]
      if (planState) {
        let currentWeek = Number(planState.current_week || 1)
        const totalWeeks = Number(planState.total_weeks || currentWeek)
        while (currentWeek < totalWeeks) {
          const [pendingRows] = await connection.execute(
            `SELECT COUNT(*) AS pending_count FROM plan_session
             WHERE plan_id = ? AND week_no = ? AND status = 'pending'`,
            [log.plan_id, currentWeek],
          )
          if (Number(pendingRows[0]?.pending_count || 0) > 0) break
          await connection.execute(
            `UPDATE plan_week SET status = 'completed' WHERE plan_id = ? AND week_no = ?`,
            [log.plan_id, currentWeek],
          )
          currentWeek += 1
          await connection.execute(
            `UPDATE plan_week SET status = 'unlocked' WHERE plan_id = ? AND week_no = ?`,
            [log.plan_id, currentWeek],
          )
        }
        await connection.execute(
          'UPDATE training_plan SET current_week = ? WHERE id = ? AND user_id = ?',
          [currentWeek, log.plan_id, req.auth.sub],
        )
      }
    }
    await connection.execute(
      `UPDATE adjustment_log SET user_decision = ?, decided_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [decision, log.id],
    )
    await connection.commit()
    return res.json({ saved: true, decision })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
})

export default router

export { detectAdjustmentTriggers }
