/**
 * 配速 / 时长格式化工具。
 * 全站统一口径：配速用 mm'ss"/km，时长用 mm:ss 或 h:mm:ss。
 */

/** 秒 → mm'ss" */
export function formatPace(secPerKm) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '--'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}

/** 秒 → mm:ss（时长） */
export function formatDuration(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec < 0) return '00:00'
  const s = Math.round(totalSec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** 秒 → “X分Y秒” */
export function formatDurationCn(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec < 0) return '--'
  const s = Math.round(totalSec)
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}秒`
  if (sec === 0) return `${m}分`
  return `${m}分${sec}秒`
}

/** 秒 → “mm'ss"”（与 formatPace 同形，用于目标用时展示） */
export function formatClock(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}

/**
 * 解析用户输入的 "mm:ss" / "mm'ss\"" / "58分30秒" / 纯秒数 → 秒。
 * @returns {number|null} 解析失败返回 null
 */
export function parseDuration(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text) return null

  if (/^\d+$/.test(text)) return Number(text)

  // 58'30"  |  58'30  |  58:30
  let m = text.match(/^(\d+)\s*['′]\s*(\d+)\s*["″]?$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])

  m = text.match(/^(\d+)\s*[:：]\s*(\d+)$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])

  // 58分30秒
  m = text.match(/^(\d+)\s*分\s*(\d+)\s*秒$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])

  // 1小时02分
  m = text.match(/^(\d+)\s*小时\s*(\d+)\s*分$/)
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60

  return null
}

/** 距离(km) + 配速(秒/km) → 秒 */
export function estimateDurationSec(distanceKm, paceSecPerKm) {
  if (!distanceKm || !paceSecPerKm) return 0
  return Math.round(distanceKm * paceSecPerKm)
}

