/**
 * 真实 GPS 训练服务。
 * 使用浏览器 Geolocation API 采集设备定位，不生成模拟轨迹。
 * 运行环境必须是 localhost 或 HTTPS，并且用户需要允许定位权限。
 */

const MAX_SPEED_MPS = 12
const MAX_ACCURACY_METERS = 30
const AUTO_PAUSE_SEC = 15

function distanceMeters(a, b) {
  const earthRadius = 6371000
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function errorMessage(error) {
  if (error?.code === 1) return '定位权限被拒绝，请在浏览器设置中允许本网站使用定位。'
  if (error?.code === 2) return '暂时无法获取当前位置，请到室外或信号较好的地方重试。'
  if (error?.code === 3) return '获取当前位置超时，请检查手机定位和网络后重试。'
  return '当前设备不支持定位，请更换手机或浏览器重试。'
}

export class GpsService {
  constructor(session, { onError } = {}) {
    this.session = session
    this.onError = onError
    this.status = 'idle'
    this.elapsedSec = 0
    this.distanceKm = 0
    this.points = []
    this.zoneSeconds = {}
    this.laps = []
    this.window = []
    this.pauseCount = 0
    this.peakPace = 0
    this.watchId = null
    this.lastPoint = null
    this.lastMovementAt = null
    this.lastTickAt = null
    this.lastKm = 0
  }

  get targetSpeed() {
    const { paceLow = 420, paceHigh = 450 } = this.session?.intensity || {}
    return 1000 / (((paceLow + paceHigh) / 2) || 420)
  }

  get currentPace() {
    const valid = this.window.filter((item) => item.speed > 0.3)
    if (!valid.length) return 0
    const avg = valid.reduce((sum, item) => sum + item.speed, 0) / valid.length
    return avg > 0.3 ? Math.round(1000 / avg) : 0
  }

  get averagePace() {
    return this.distanceKm > 0.01 ? Math.round(this.elapsedSec / this.distanceKm) : 0
  }

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
    const uniApi = globalThis.uni
    if (uniApi?.startLocationUpdate && uniApi?.onLocationChange) {
      return this._startUniLocation(uniApi)
    }
    if (!globalThis.navigator?.geolocation) {
      this._fail({ code: 0 })
      return false
    }
    if (globalThis.isSecureContext === false && globalThis.location?.hostname !== 'localhost' && globalThis.location?.hostname !== '127.0.0.1') {
      this._fail(new Error('真实 GPS 需要 HTTPS 或 localhost'))
      return false
    }
    this.status = 'running'
    this.lastTickAt = Date.now()
    this.lastMovementAt = Date.now()
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this._handlePosition(position),
      (error) => this._fail(error),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    )
    return true
  }

  _startUniLocation(uniApi) {
    this.status = 'running'
    this.lastTickAt = Date.now()
    this.lastMovementAt = Date.now()
    this._uniPositionHandler = (position) => this._handlePosition(position)
    this._uniErrorHandler = (error) => this._fail(error)
    uniApi.onLocationChange(this._uniPositionHandler)
    if (uniApi.onLocationChangeError) uniApi.onLocationChangeError(this._uniErrorHandler)
    uniApi.startLocationUpdate({
      type: 'wgs84',
      success: () => {},
      fail: (error) => this._fail(error),
    })
    return true
  }

  _fail(error) {
    this.stopWatching()
    this.status = 'error'
    this.errorMessage = error?.message || errorMessage(error)
    this.onError?.(this.errorMessage)
  }

  stopWatching() {
    const uniApi = globalThis.uni
    if (uniApi?.stopLocationUpdate && this._uniPositionHandler) {
      uniApi.stopLocationUpdate({})
      uniApi.offLocationChange?.(this._uniPositionHandler)
      if (this._uniErrorHandler) uniApi.offLocationChangeError?.(this._uniErrorHandler)
      this._uniPositionHandler = null
      this._uniErrorHandler = null
    }
    if (this.watchId !== null && globalThis.navigator?.geolocation) {
      navigator.geolocation.clearWatch(this.watchId)
    }
    this.watchId = null
  }

  pause() {
    if (this.status !== 'running') return
    this.status = 'paused'
    this.pauseCount += 1
    this.lastTickAt = Date.now()
  }

  resume() {
    if (this.status !== 'paused') return
    this.status = 'running'
    this.lastTickAt = Date.now()
    this.lastMovementAt = Date.now()
  }

  toggle() {
    if (this.status === 'running') this.pause()
    else if (this.status === 'paused') this.resume()
  }

  markLap() {
    this.laps.push({ index: this.laps.length + 1, distanceKm: this.distanceKm, elapsedSec: this.elapsedSec })
  }

  _handlePosition(position) {
    const coords = position.coords || position
    const point = {
      lat: Number(coords.latitude),
      lng: Number(coords.longitude),
      accuracy: Number(coords.accuracy),
      ts: Number(position.timestamp) || Date.now(),
    }
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return
    if (!Number.isFinite(point.accuracy) || point.accuracy > MAX_ACCURACY_METERS) return

    if (!this.lastPoint) {
      this.lastPoint = point
      this.points.push({ ...point, speed: 0 })
      return
    }

    const seconds = Math.max(1, (point.ts - this.lastPoint.ts) / 1000)
    const meters = distanceMeters(this.lastPoint, point)
    const derivedSpeed = meters / seconds
    const deviceSpeed = Number(coords.speed)
    const speed = Number.isFinite(deviceSpeed) && deviceSpeed >= 0 ? deviceSpeed : derivedSpeed

    // 更新基准点，避免恢复定位后把断联期间的位移一次性算入本次跑步。
    if (this.status === 'paused') {
      this.lastPoint = point
      return
    }
    if (speed > MAX_SPEED_MPS) {
      this.lastPoint = point
      return
    }

    this.lastPoint = point
    if (meters > 0.5) {
      this.distanceKm += meters / 1000
      this.lastMovementAt = Date.now()
    }
    this.window.push({ speed, t: point.ts })
    while (this.window.length && point.ts - this.window[0].t > 60000) this.window.shift()

    const zone = this.currentZone
    this.zoneSeconds[zone] = (this.zoneSeconds[zone] || 0) + seconds
    const pace = this.currentPace
    if (pace && (!this.peakPace || pace < this.peakPace)) this.peakPace = pace
    this.points.push({ ...point, speed })
  }

  tick() {
    const events = { autoPaused: false, autoResumed: false, kmCompleted: false, staticRunning: false }
    if (this.status !== 'running') return events

    const now = Date.now()
    const delta = Math.max(0, Math.min(2, (now - (this.lastTickAt || now)) / 1000))
    this.lastTickAt = now
    this.elapsedSec += delta

    if (now - (this.lastMovementAt || now) >= AUTO_PAUSE_SEC * 1000) {
      this.pause()
      events.autoPaused = true
      return events
    }
    events.staticRunning = now - (this.lastMovementAt || now) >= 3000
    const currentKm = Math.floor(this.distanceKm)
    if (currentKm > this.lastKm) {
      this.lastKm = currentKm
      events.kmCompleted = true
    }
    return events
  }

  finish() {
    this.stopWatching()
    this.status = 'finished'
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

