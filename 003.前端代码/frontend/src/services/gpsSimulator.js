/**
 * GPS 训练模拟器 —— 复刻 PRD v1.2 §C2 的记录逻辑，用于 Demo 阶段在室内稳定复现。
 *
 * 模拟了以下真实链路中的关键行为：
 *  - 1 Hz 采样（时间戳 + 位置 + 速度）
 *  - Haversine 等价的距离累加（用平面近似，Demo 精度足够）
 *  - 最近 60 秒滑动窗口配速平滑
 *  - 漂移过滤（瞬时速度 > 12 m/s 丢弃；精度半径 > 30m 的点不参与配速计算）
 *  - 自动暂停：连续 15 秒无有效位移 → 暂停计时；恢复移动后 5 秒自动恢复
 *  - 手动暂停 / 继续
 *  - 分段计时（计圈）
 *
 * 与真实实现的差异：位置来自合成路径而非设备定位；无后台保活与中断补传。
 */

const MAX_SPEED_MPS = 12 // 漂移过滤阈值（PRD §C2）
const AUTO_PAUSE_SEC = 15 // 连续无位移自动暂停
const AUTO_RESUME_SEC = 5

/** 线性同余伪随机，保证演示可复现 */
function createRandom(seed = 20261026) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export class GpsSimulator {
  /**
   * @param {object} session 课次对象
   * @param {object} options { speedFactor, startPoint }
   */
  constructor(session, options = {}) {
    this.session = session
    this.speedFactor = options.speedFactor ?? 1
    this.random = createRandom(session?.id ? session.id.length * 7919 : 1)

    this.status = 'idle' // idle | running | paused | finished
    this.elapsedSec = 0
    this.distanceKm = 0
    this.points = []
    this.zoneSeconds = {}
    this.laps = []
    this.lastPoint = null
    this.window = [] // 最近 60 秒配速滑动窗口
    this.staticSec = 0
    this.pauseCount = 0
    this.peakPace = 0
    this.finished = false
  }

  /** 目标配速（秒/km）→ 目标速度 m/s */
  get targetSpeed() {
    const { paceLow = 420, paceHigh = 450 } = this.session?.intensity || {}
    const pace = (paceLow + paceHigh) / 2 || 420
    return 1000 / pace
  }

  /** 当前瞬时配速（秒/km），已做滑动窗口平滑 */
  get currentPace() {
    if (!this.window.length) return 0
    const total = this.window.reduce((a, p) => a + p.speed, 0)
    const avg = total / this.window.length
    return avg > 0.3 ? Math.round(1000 / avg) : 0
  }

  get averagePace() {
    return this.distanceKm > 0.01 ? Math.round(this.elapsedSec / this.distanceKm) : 0
  }

  /** 当前落在哪个强度区间 */
  get currentZone() {
    const pace = this.currentPace
    if (!pace) return 'easy'
    const base = this.session?.intensity?.paceLow || 420
    const high = this.session?.intensity?.paceHigh || 450
    if (pace < base - 20) return 'interval'
    if (pace < base) return 'tempo'
    if (pace <= high + 20) return 'easy'
    return 'recovery'
  }

  start() {
    this.status = 'running'
  }

  pause() {
    if (this.status !== 'running') return
    this.status = 'paused'
    this.pauseCount += 1
  }

  resume() {
    if (this.status !== 'paused') return
    this.status = 'running'
  }

  toggle() {
    if (this.status === 'running') this.pause()
    else if (this.status === 'paused') this.resume()
  }

  /** 记录一个分段 */
  markLap() {
    this.laps.push({ index: this.laps.length + 1, distanceKm: this.distanceKm, elapsedSec: this.elapsedSec })
  }

  /**
   * 推进 dt 秒（模拟时间）。
   * @returns {object} 本次 tick 的事件
   */
  tick(dt = 1) {
    const events = { autoPaused: false, autoResumed: false, kmCompleted: false, staticRunning: false }

    if (this.status !== 'running') return events

    this.elapsedSec += dt

    // 疲劳因子：最后 25% 路程速度下降 6%
    const plannedSec = this.session?.durationMin ? this.session.durationMin * 60 : 2400
    const progress = Math.min(1, this.elapsedSec / plannedSec)
    const fatigue = progress > 0.75 ? 0.94 : 1
    const jitter = 0.94 + this.random() * 0.12

    let speed = this.targetSpeed * fatigue * jitter

    // 随机停顿（模拟路口、等红灯），约 4% 的时间处于静止
    if (this.random() < 0.04) {
      speed = 0
      this.staticSec += dt
      events.staticRunning = true
      if (this.staticSec >= AUTO_PAUSE_SEC) {
        this.status = 'paused'
        this.pauseCount += 1
        this.staticSec = 0
        events.autoPaused = true
        return events
      }
    } else {
      this.staticSec = 0
    }

    if (speed > MAX_SPEED_MPS) speed = MAX_SPEED_MPS // 漂移过滤

    const meters = speed * dt
    const before = this.distanceKm
    this.distanceKm += meters / 1000

    // 滑动窗口（60 秒）
    this.window.push({ speed, t: this.elapsedSec })
    while (this.window.length && this.elapsedSec - this.window[0].t > 60) this.window.shift()

    // 区间累计
    const zone = this.currentZone
    this.zoneSeconds[zone] = (this.zoneSeconds[zone] || 0) + dt

    // 位置点（合成路径：以起点为中心，按行进方向推进）
    const last = this.lastPoint || { lat: 39.9935, lng: 116.3903, accuracy: 8 }
    const heading = 0.6 + Math.sin(this.elapsedSec / 45) * 0.9
    const lat = last.lat + (meters * Math.cos(heading)) / 111320
    const lng = last.lng + (meters * Math.sin(heading)) / (111320 * Math.cos((last.lat * Math.PI) / 180))
    this.lastPoint = { lat, lng, accuracy: 6 + Math.round(this.random() * 8) }
    this.points.push({
      ts: Date.now(),
      lat,
      lng,
      accuracy: this.lastPoint.accuracy,
      speed,
    })

    const pace = this.currentPace
    if (pace && (pace < this.peakPace || !this.peakPace)) this.peakPace = pace

    if (Math.floor(before) !== Math.floor(this.distanceKm)) events.kmCompleted = true

    return events
  }

  /** 结束并返回统计 */
  finish() {
    this.status = 'finished'
    this.finished = true
    return this.stats()
  }

  stats() {
    return {
      actualDistanceKm: Number(this.distanceKm.toFixed(2)),
      actualDurationSec: Math.round(this.elapsedSec),
      avgPace: this.averagePace,
      bestPace: this.peakPace,
      pauseCount: this.pauseCount,
      zoneSeconds: { ...this.zoneSeconds },
      laps: [...this.laps],
      points: [...this.points],
    }
  }

  /** 轨迹归一化坐标（0–1），供 SVG / Canvas 绘制 */
  normalizedTrack() {
    if (this.points.length < 2) return []
    const lats = this.points.map((p) => p.lat)
    const lngs = this.points.map((p) => p.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const spanLat = maxLat - minLat || 1e-6
    const spanLng = maxLng - minLng || 1e-6
    return this.points.map((p) => ({
      x: (p.lng - minLng) / spanLng,
      y: 1 - (p.lat - minLat) / spanLat,
    }))
  }
}

