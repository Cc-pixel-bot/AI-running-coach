import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { matchTrainingTemplate } from '../domain/templateMatcher.js'

const router = Router()

function isMedicalRisk(profile) {
  return profile?.riskLevel === 'medical_confirm' || profile?.screening?.riskLevel === 'medical_confirm'
}

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value
  try { return value ? JSON.parse(value) : fallback } catch { return fallback }
}

function formatPace(seconds) {
  const value = Number(seconds || 0)
  if (!value) return ''
  return `${Math.floor(value / 60)}分${String(Math.round(value % 60)).padStart(2, '0')}秒/公里`
}

function currentPlanFromRows(rows) {
  if (!rows.length) return null
  const first = rows[0]
  const weekMap = new Map()
  rows.forEach((row) => {
    if (!weekMap.has(row.week_no)) {
      weekMap.set(row.week_no, {
        week: Number(row.week_no),
        phase: row.phase,
        phaseName: row.phase_name,
        focus: row.focus || '',
        targetKm: Number(row.week_target_km || 0),
        totalKm: Number(row.week_target_km || 0),
        stepBack: Boolean(row.is_step_back),
        taper: Boolean(row.is_taper),
        sessions: [],
      })
    }
    const rawStructure = parseJson(row.structure, {})
    const structure = typeof rawStructure === 'string' ? { pattern: rawStructure } : (rawStructure || {})
    const warmup = parseJson(row.warmup, []) || []
    const cooldown = parseJson(row.cooldown, []) || []
    const session = {
      id: `w${row.week_no}s${row.seq}`,
      week: Number(row.week_no),
      dayOffset: Number(row.day_offset || 0),
      dayLabel: `第${row.seq}天`,
      status: row.status,
      type: row.type,
      title: row.title,
      description: row.description || '',
      distanceKm: Number(row.target_distance_km || 0),
      durationMin: Number(row.target_duration_min || 0),
      intensity: {
        level: row.type === 'easy' || row.type === 'long' ? '轻松' : '受控',
        paceLow: Number(row.pace_low_sec || 0),
        paceHigh: Number(row.pace_high_sec || 0),
        rpe: [Number(row.rpe_low || 0), Number(row.rpe_high || 0)],
      },
      structure: structure.pattern || structure,
      preRunWarmup: { title: '练前动态激活', duration: 5, exercises: warmup },
      postRunStretch: { title: '练后静态拉伸', duration: 5, exercises: cooldown },
      warmup,
      cooldown,
      mainRun: structure.mainRun || {
        type: row.type,
        distanceKm: Number(row.target_distance_km || 0),
        durationMin: Number(row.target_duration_min || 0),
      },
      adaptationNote: row.adaptation_note || '',
      exercises: parseJson(row.exercises, []) || [],
    }
    weekMap.get(row.week_no).sessions.push(session)
  })
  return {
    templateId: first.template_id,
    templateName: first.template_name || '10 公里训练计划',
    targetDistance: '10K',
    goalPace: formatPace(first.goal_pace_sec),
    goalTotalSec: Number(first.target_time_sec || 0),
    status: first.plan_status,
    currentWeek: Number(first.current_week || 1),
    totalWeeks: Number(first.total_weeks || 8),
    startDate: first.start_date,
    totalKm: Number(first.total_target_km || 0),
    adaptationSummary: parseJson(first.adaptation_summary, first.adaptation_summary || ''),
    weeks: [...weekMap.values()],
  }
}

router.post('/match-template', requireAuth, async (req, res) => {
  const profile = req.body?.profile || {}
  if (profile.targetDistance !== '10K' && profile.targetDistance !== '10km') {
    return res.status(400).json({ message: '当前 Demo 仅支持 10 公里目标' })
  }
  if (isMedicalRisk(profile)) {
    return res.status(409).json({ blocked: true, message: '当前风险筛查需要医疗确认，暂不能生成正常训练计划' })
  }

  const template = matchTrainingTemplate(profile)
  return res.json({
    blocked: false,
    template: {
      ...template,
      sourceRefs: template.sourceRefs.map((source) => ({ ...source })),
      blueprint: template.blueprint.map((week) => ({ ...week, qualityPlan: { ...week.qualityPlan } })),
    },
    source: 'training_template_library',
  })
})

router.get('/current', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT tp.id AS plan_id, tp.status AS plan_status, tp.current_week, tp.total_weeks,
              tp.total_target_km, tp.goal_pace_sec, tp.target_time_sec, tp.start_date,
              tp.adaptation_summary, tt.id AS template_id, tt.name AS template_name,
              pw.week_no, pw.phase, pw.phase_name, pw.focus, pw.target_km AS week_target_km,
              pw.is_step_back, pw.is_taper,
              ps.seq, ps.day_offset, ps.type, ps.title, ps.description, ps.structure,
              ps.target_distance_km, ps.target_duration_min, ps.pace_low_sec, ps.pace_high_sec,
              ps.rpe_low, ps.rpe_high, ps.warmup, ps.cooldown, ps.exercises,
              ps.adaptation_note, ps.status
       FROM training_plan tp
       JOIN training_template tt ON tt.id = tp.template_id
       JOIN plan_week pw ON pw.plan_id = tp.id
       JOIN plan_session ps ON ps.plan_id = tp.id AND ps.week_id = pw.id
       WHERE tp.user_id = ? AND tp.status IN ('active', 'pending_confirm', 'paused')
       ORDER BY tp.id DESC, pw.week_no, ps.seq
       LIMIT 1000`,
      [req.auth.sub],
    )
    return res.json({ plan: currentPlanFromRows(rows) })
  } catch (error) {
    return next(error)
  }
})

router.post('/confirm', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      `UPDATE training_plan
       SET status = 'active', confirmed_at = CURRENT_TIMESTAMP(3)
       WHERE user_id = ? AND status = 'pending_confirm'
       ORDER BY id DESC LIMIT 1`,
      [req.auth.sub],
    )
    if (!result.affectedRows) return res.status(404).json({ message: '没有待确认的训练计划' })
    return res.json({ confirmed: true })
  } catch (error) {
    return next(error)
  }
})

export default router
