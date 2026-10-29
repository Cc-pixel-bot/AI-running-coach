import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function json(value, fallback = {}) {
  return JSON.stringify(value === undefined || value === null ? fallback : value)
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function deriveCompletion({ targetDistanceKm, targetDurationMin, targetPaceLow, targetPaceHigh, actualDistanceKm, actualDurationMin }) {
  const targetDistance = Number(targetDistanceKm) || 0
  const targetDuration = Number(targetDurationMin) || 0
  const distance = Number(actualDistanceKm) || 0
  const duration = Number(actualDurationMin) || 0
  if (!targetDistance || distance <= 0) return 'none'

  const distanceRatio = distance / targetDistance
  const durationRatio = targetDuration > 0 ? duration / targetDuration : 1
  const pace = distance > 0 && duration > 0 ? (duration * 60) / distance : 0
  const paceUsable = !pace || (
    (!targetPaceLow || pace >= targetPaceLow * 0.75)
    && (!targetPaceHigh || pace <= targetPaceHigh * 1.35)
  )

  if (distanceRatio >= 0.95 && durationRatio >= 0.8 && paceUsable) return 'full'
  if (distanceRatio >= 0.75 && durationRatio >= 0.6) return 'mostly'
  if (distanceRatio >= 0.3 || durationRatio >= 0.3) return 'partial'
  return 'none'
}

function parseSessionKey(value) {
  const match = String(value || '').match(/^w(\d+)s(\d+)$/i)
  return match ? { week: Number(match[1]), seq: Number(match[2]) } : null
}

async function findSession(userId, sessionKey, connection = pool) {
  const parsed = parseSessionKey(sessionKey)
  if (!parsed) return null
  const [rows] = await connection.execute(
    `SELECT ps.*, tp.id AS plan_id, tp.status AS plan_status
     FROM plan_session ps
     JOIN training_plan tp ON tp.id = ps.plan_id
     WHERE tp.user_id = ? AND ps.week_no = ? AND ps.seq = ?
       AND tp.status IN ('active', 'pending_confirm', 'paused')
     ORDER BY tp.id DESC LIMIT 1`,
    [userId, parsed.week, parsed.seq],
  )
  return rows[0] || null
}

router.post('/', requireAuth, async (req, res, next) => {
  const body = req.body || {}
  const connection = await pool.getConnection()
  try {
    const session = await findSession(req.auth.sub, body.sessionId, connection)
    if (!session) return res.status(404).json({ message: '找不到对应训练课次，请先确认训练计划' })
    const points = (Array.isArray(body.points) ? body.points : [])
      .filter((point) => {
        const lat = Number(point?.lat)
        const lng = Number(point?.lng)
        return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
      })
      .slice(0, 20000)
    await connection.beginTransaction()
    const [result] = await connection.execute(
      `INSERT INTO session_record (
        user_id, plan_id, session_id, started_at, ended_at, duration_sec,
        distance_km, avg_pace_sec, best_pace_sec, pause_count, zone_seconds, prep_checklist, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        req.auth.sub,
        session.plan_id,
        session.id,
        body.startedAt ? new Date(body.startedAt) : null,
        body.endedAt ? new Date(body.endedAt) : new Date(),
        numberOrNull(body.actualDurationSec),
        numberOrNull(body.actualDistanceKm),
        numberOrNull(body.avgPace),
        numberOrNull(body.bestPace),
        Number(body.pauseCount || 0),
        json(body.zoneSeconds, {}),
        json(body.prepChecklist, {}),
      ],
    )
    const recordId = result.insertId
    const [trackResult] = await connection.execute(
      `INSERT INTO gps_track (user_id, record_id, started_at, ended_at, sample_count)
       VALUES (?, ?, ?, ?, ?)`,
      [req.auth.sub, recordId, body.startedAt ? new Date(body.startedAt) : null, new Date(), points.length],
    )
    if (points.length) {
      const values = points.map((point) => [
        trackResult.insertId,
        new Date(point.ts || Date.now()),
        Number(point.lat),
        Number(point.lng),
        numberOrNull(point.accuracy),
        numberOrNull(point.speed),
        1,
      ])
      await connection.query(
        `INSERT INTO gps_point (track_id, recorded_at, latitude, longitude, accuracy_m, speed_mps, is_valid)
         VALUES ?`,
        [values],
      )
    }
    await connection.commit()
    return res.status(201).json({ recordId: Number(recordId), sessionId: body.sessionId })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
})

router.post('/:id/complete', requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection()
  try {
    const [rows] = await connection.execute(
      `SELECT sr.session_id, ps.id AS plan_session_id, ps.plan_id
       FROM session_record sr
       JOIN plan_session ps ON ps.id = sr.session_id
       WHERE sr.id = ? AND sr.user_id = ? LIMIT 1`,
      [req.params.id, req.auth.sub],
    )
    const record = rows[0]
    if (!record) return res.status(404).json({ message: '训练记录不存在' })
    await connection.beginTransaction()
    await connection.execute('UPDATE plan_session SET status = \'done\' WHERE id = ? AND plan_id = ?', [record.plan_session_id, record.plan_id])
    const [planRows] = await connection.execute('SELECT current_week, total_weeks FROM training_plan WHERE id = ? AND user_id = ? LIMIT 1', [record.plan_id, req.auth.sub])
    const planState = planRows[0]
    if (planState) {
      let currentWeek = Number(planState.current_week || 1)
      const totalWeeks = Number(planState.total_weeks || currentWeek)
      while (currentWeek < totalWeeks) {
        const [pendingRows] = await connection.execute(
          "SELECT COUNT(*) AS pending_count FROM plan_session WHERE plan_id = ? AND week_no = ? AND status = 'pending'",
          [record.plan_id, currentWeek],
        )
        if (Number(pendingRows[0]?.pending_count || 0) > 0) break
        await connection.execute("UPDATE plan_week SET status = 'completed' WHERE plan_id = ? AND week_no = ?", [record.plan_id, currentWeek])
        currentWeek += 1
        await connection.execute("UPDATE plan_week SET status = 'unlocked' WHERE plan_id = ? AND week_no = ?", [record.plan_id, currentWeek])
      }
      await connection.execute('UPDATE training_plan SET current_week = ? WHERE id = ? AND user_id = ?', [currentWeek, record.plan_id, req.auth.sub])
    }
    await connection.commit()
    return res.json({ completed: true, sessionId: record.session_id })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
})

router.post('/:id/feedback', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {}
    const feelValues = new Set(['easy', 'normal', 'fatigued', 'very_hard'])
    const rpe = body.rpe === undefined || body.rpe === null || body.rpe === '' ? null : Number(body.rpe)
    const painScore = Number(body.painScore ?? 0)
    if (body.feel && !feelValues.has(body.feel)) return res.status(400).json({ message: '身体感受数据无效' })
    if (rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) return res.status(400).json({ message: '主观强度需为 1 到 10' })
    if (!Number.isFinite(painScore) || painScore < 0 || painScore > 10) return res.status(400).json({ message: '疼痛程度需为 0 到 10' })
    const [contextRows] = await pool.execute(
      `SELECT sr.distance_km AS record_distance_km, sr.duration_sec AS record_duration_sec,
              ps.target_distance_km, ps.target_duration_min, ps.pace_low_sec, ps.pace_high_sec
       FROM session_record sr
       JOIN plan_session ps ON ps.id = sr.session_id
       WHERE sr.id = ? AND sr.user_id = ? LIMIT 1`,
      [req.params.id, req.auth.sub],
    )
    const context = contextRows[0]
    if (!context) return res.status(404).json({ message: '训练记录不存在' })
    const actualDistanceKm = numberOrNull(body.actualDistanceKm) ?? numberOrNull(context.record_distance_km) ?? 0
    const actualDurationMin = numberOrNull(body.actualDurationMin) ?? (Number(context.record_duration_sec || 0) / 60)
    const completion = deriveCompletion({
      targetDistanceKm: context.target_distance_km,
      targetDurationMin: context.target_duration_min,
      targetPaceLow: context.pace_low_sec,
      targetPaceHigh: context.pace_high_sec,
      actualDistanceKm,
      actualDurationMin,
    })
    const [result] = await pool.execute(
      `INSERT INTO training_feedback (
        record_id, completion, actual_distance_km, actual_duration_min, rpe,
        feel, pain_score, pain_parts, note, llm_signals
      )
      SELECT sr.id, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM session_record sr
      WHERE sr.id = ? AND sr.user_id = ?
      ON DUPLICATE KEY UPDATE
        completion = VALUES(completion), actual_distance_km = VALUES(actual_distance_km),
        actual_duration_min = VALUES(actual_duration_min), rpe = VALUES(rpe),
        feel = VALUES(feel), pain_score = VALUES(pain_score), pain_parts = VALUES(pain_parts),
        note = VALUES(note), llm_signals = VALUES(llm_signals)`,
      [
        completion,
        actualDistanceKm,
        actualDurationMin,
        rpe,
        body.feel || null,
        painScore,
        json(body.painParts, []),
        body.note || null,
        json(body.llmSignals, {}),
        req.params.id,
        req.auth.sub,
      ],
    )
    if (!result.affectedRows) return res.status(404).json({ message: '训练记录不存在' })
    return res.json({ saved: true, recordId: Number(req.params.id) })
  } catch (error) {
    return next(error)
  }
})

export default router
