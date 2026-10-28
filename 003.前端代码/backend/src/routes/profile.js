import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isFilled(value) {
  return value !== undefined && value !== null && value !== ''
}

function validateProfile(body) {
  const required = [
    ['gender', '生理性别'],
    ['birthYear', '出生年份'],
    ['heightCm', '身高'],
    ['weightKg', '体重'],
    ['runsPerWeek', '最近每周跑步次数'],
    ['weeklyKm', '近3个月周跑量'],
    ['longestRunKm', '最近最长一次连续跑'],
    ['easyPace', '平时舒服慢跑配速'],
    ['targetDistance', '目标项目'],
    ['targetType', '训练目标'],
    ['targetTime', '目标完成成绩'],
    ['availableDays', '每周可训练天数'],
    ['availableMin', '单次最大时长'],
  ]
  const missing = required.find(([key]) => !isFilled(body[key]))
  if (missing) return `请先填写${missing[1]}`
  if (!Array.isArray(body.terrain) || body.terrain.length === 0) return '请先选择主要训练场地'

  const screening = body.screening || {}
  if (!isFilled(screening.q1) || !Array.isArray(screening.q2) || screening.q2.length === 0 || !isFilled(screening.q3)) {
    return '请先完成运动风险筛查'
  }
  return null
}

function profileFromRow(row) {
  if (!row) return null
  const screening = row.screening_result || {}
  return {
    id: Number(row.id),
    gender: row.gender,
    birthYear: row.birth_year,
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    runsPerWeek: row.runs_per_week,
    weeklyKm: row.weekly_km === null ? null : Number(row.weekly_km),
    longestRunKm: row.longest_run_km === null ? null : Number(row.longest_run_km),
    best5kPace: row.best_5k_pace_sec,
    best10kPace: row.best_10k_pace_sec,
    bestHmPace: row.best_hm_pace_sec,
    bestMarPace: row.best_marathon_pace_sec,
    easyPace: row.easy_pace_sec,
    targetDistance: row.target_distance,
    targetType: row.target_type,
    targetTime: row.target_time_sec,
    targetPace: row.target_pace_sec,
    riskLevel: screening.riskLevel || 'low',
    injuries: row.injury_flags || [],
    screening: screening.answers || {},
    availableDays: row.available_days,
    availableMin: row.available_min,
    terrain: row.terrain || [],
    equipment: row.equipment || [],
    confirmedAt: row.confirmed_at,
    profileConfirmed: Boolean(row.confirmed_at),
  }
}

function isCompleteProfileRow(row) {
  if (!row) return false
  const screening = row.screening_result || {}
  return [
    row.gender,
    row.birth_year,
    row.height_cm,
    row.weight_kg,
    row.runs_per_week,
    row.weekly_km,
    row.longest_run_km,
    row.easy_pace_sec,
    row.target_distance,
    row.target_type,
    row.target_time_sec,
    row.available_days,
    row.available_min,
  ].every(isFilled)
    && Array.isArray(row.terrain)
    && row.terrain.length > 0
    && isFilled(screening.answers?.q1)
    && Array.isArray(screening.answers?.q2)
    && screening.answers.q2.length > 0
    && isFilled(screening.answers?.q3)
}

async function findProfile(userId) {
  const [rows] = await pool.execute('SELECT * FROM runner_profile WHERE user_id = ? LIMIT 1', [userId])
  return rows[0] || null
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const row = await findProfile(req.auth.sub)
    return res.json({ profile: isCompleteProfileRow(row) ? profileFromRow(row) : null })
  } catch (error) {
    return next(error)
  }
})

router.put('/', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const body = req.body || {}
    const validationError = validateProfile(body)
    if (validationError) return res.status(400).json({ message: validationError })
    const screening = body.screening || {}
    const riskLevel = body.riskLevel || 'low'
    const values = [
      req.auth.sub,
      body.gender || null,
      numberOrNull(body.birthYear),
      numberOrNull(body.heightCm),
      numberOrNull(body.weightKg),
      body.runningYearsBucket || null,
      numberOrNull(body.runsPerWeek),
      numberOrNull(body.weeklyKm),
      numberOrNull(body.longestRunKm),
      numberOrNull(body.best5kPace),
      numberOrNull(body.best10kPace),
      numberOrNull(body.bestHmPace),
      numberOrNull(body.bestMarPace),
      numberOrNull(body.easyPace),
      body.targetDistance || null,
      body.targetType || null,
      numberOrNull(body.targetTime),
      numberOrNull(body.targetPace),
      JSON.stringify(body.raceHistory || []),
      JSON.stringify(body.injuries || []),
      JSON.stringify({ answers: screening, riskLevel, cleared: riskLevel !== 'medical_confirm' }),
      numberOrNull(body.availableDays),
      numberOrNull(body.availableMin),
      JSON.stringify(body.terrain || []),
      JSON.stringify(body.equipment || []),
      JSON.stringify(body.aiInferredFields || {}),
    ]

    await connection.beginTransaction()
    await connection.execute(
      `INSERT INTO runner_profile (
        user_id, gender, birth_year, height_cm, weight_kg, running_years_bucket,
        runs_per_week, weekly_km, longest_run_km, best_5k_pace_sec, best_10k_pace_sec,
        best_hm_pace_sec, best_marathon_pace_sec, easy_pace_sec, target_distance,
        target_type, target_time_sec, target_pace_sec, race_history, injury_flags,
        screening_result, available_days, available_min, terrain, equipment, ai_inferred_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        gender = VALUES(gender), birth_year = VALUES(birth_year), height_cm = VALUES(height_cm),
        weight_kg = VALUES(weight_kg), running_years_bucket = VALUES(running_years_bucket),
        runs_per_week = VALUES(runs_per_week), weekly_km = VALUES(weekly_km),
        longest_run_km = VALUES(longest_run_km), best_5k_pace_sec = VALUES(best_5k_pace_sec),
        best_10k_pace_sec = VALUES(best_10k_pace_sec), best_hm_pace_sec = VALUES(best_hm_pace_sec),
        best_marathon_pace_sec = VALUES(best_marathon_pace_sec), easy_pace_sec = VALUES(easy_pace_sec),
        target_distance = VALUES(target_distance), target_type = VALUES(target_type),
        target_time_sec = VALUES(target_time_sec), target_pace_sec = VALUES(target_pace_sec),
        race_history = VALUES(race_history), injury_flags = VALUES(injury_flags),
        screening_result = VALUES(screening_result), available_days = VALUES(available_days),
        available_min = VALUES(available_min), terrain = VALUES(terrain), equipment = VALUES(equipment),
        ai_inferred_fields = VALUES(ai_inferred_fields), confirmed_at = NULL`,
      values,
    )
    await connection.commit()
    const row = await findProfile(req.auth.sub)
    return res.json({ profile: profileFromRow(row) })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
})

router.post('/confirm', requireAuth, async (req, res, next) => {
  try {
    const row = await findProfile(req.auth.sub)
    if (!isCompleteProfileRow(row)) {
      return res.status(409).json({
        message: '档案信息不完整，请返回建档页补充后再确认',
        canGeneratePlan: false,
      })
    }
    const screening = row.screening_result || {}
    if (screening.riskLevel === 'medical_confirm') {
      return res.status(409).json({
        message: '当前风险筛查需要医疗确认，暂不能生成训练计划',
        canGeneratePlan: false,
        riskLevel: screening.riskLevel,
      })
    }
    const [result] = await pool.execute(
      'UPDATE runner_profile SET confirmed_at = CURRENT_TIMESTAMP(3) WHERE user_id = ?',
      [req.auth.sub],
    )
    if (!result.affectedRows) return res.status(404).json({ message: '请先保存跑者档案' })
    const confirmedRow = await findProfile(req.auth.sub)
    return res.json({ profile: profileFromRow(confirmedRow), canGeneratePlan: true })
  } catch (error) {
    return next(error)
  }
})

export default router
