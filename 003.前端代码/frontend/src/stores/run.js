import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { GpsSimulator } from '../services/gpsSimulator.js'
import { buildCuePack } from '../services/voiceCoach.js'
import { buildSummary, fallbackSummary } from '../domain/engine/summaryBuilder.js'
import { usePlanStore } from './plan.js'
import { useHistoryStore } from './history.js'
import { useProfileStore } from './profile.js'
import { save } from '../services/storage.js'

/** 训练执行：GPS 记录 → 结束 → 反馈 → AI 总结与计划调整 */
export const useRunStore = defineStore('run', {
  state: () => ({
    session: null,
    simulator: null,
    cues: [],
    cueLog: [],
    elapsedSec: 0,
    distanceKm: 0,
    currentPace: 0,
    averagePace: 0,
    currentZone: 'easy',
    pauseCount: 0,
    lapCount: 0,
    /** 轨迹点（响应式镜像，避免 markRaw 的模拟器对象无法触发视图更新） */
    trackPoints: [],
    zoneSeconds: {},
    status: 'idle', // idle | running | paused | finished
    speedFactor: 1,
    record: null,
    feedback: null,
    summary: null,
    lastAdjustments: [],
    safetyNotice: null,
    /** Demo：本次训练直接给出「疼痛 5 分」的反馈预设（PRD §9.2 演示脚本） */
    demoFeedbackPreset: 'pain5',
    demoFeedbackPresets: [
      { key: 'pain5', label: '疼痛 5 分（小腿）', completion: 'mostly', rpe: 7, painScore: 5, painParts: ['小腿'], feel: 'fatigued', note: '最后 1 公里实在顶不住了，右小腿发紧。' },
      { key: 'good', label: '完全完成 · 无疼痛', completion: 'full', rpe: 6, painScore: 0, painParts: [], feel: 'normal', note: '配速稳定，最后一段还有余力。' },
      { key: 'overreach', label: '过度负荷 · RPE 9', completion: 'mostly', rpe: 9, painScore: 2, painParts: [], feel: 'very_hard', note: '全程都很吃力，呼吸压不下来。' },
    ],
  }),

  getters: {
    hasRecord: (s) => Boolean(s.record),
    hasSummary: (s) => Boolean(s.summary),
    /** 已完成的公里数 */
    completedKm: (s) => Math.floor(s.distanceKm),
    /** 目标完成度 */
    completionRatio(s) {
      const target = s.session?.distanceKm || 0
      return target ? Math.min(1, s.distanceKm / target) : 0
    },
  },

  actions: {
    startSession(session, { speedFactor = 1 } = {}) {
      this.session = session
      this.speedFactor = speedFactor
      this.simulator = markRaw(new GpsSimulator(session, { speedFactor }))
      this.cues = buildCuePack(session, { goalPaceSec: session?.intensity ? session.intensity.paceLow : 0 })
      this.cueLog = []
      this.record = null
      this.feedback = null
      this.summary = null
      this.lastAdjustments = []
      this.safetyNotice = null
      this.trackPoints = []
      this.pauseCount = 0
      this.lapCount = 0
      this.currentZone = 'easy'
      this.simulator.start()
      this.status = 'running'
      this._startTimer()
      this._pushCue('start')
    },

    _startTimer() {
      this._stopTimer()
      this.timer = setInterval(() => this._tick(), 1000)
    },
    _stopTimer() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    },
    stopTimer() {
      this._stopTimer()
    },

    _tick() {
      const sim = this.simulator
      if (!sim) return
      const events = sim.tick(this.speedFactor)
      this.elapsedSec = sim.elapsedSec
      this.distanceKm = sim.distanceKm
      this.currentPace = sim.currentPace
      this.averagePace = sim.averagePace
      this.currentZone = sim.currentZone
      this.pauseCount = sim.pauseCount
      this.lapCount = sim.laps.length
      this.zoneSeconds = sim.zoneSeconds
      this.trackPoints = sim.points.slice(-240)
      this.status = sim.status

      if (events.autoPaused) {
        this._pushCue('intensity', '检测到静止超过 15 秒，已自动暂停计时（暂停时段不计入用时）。')
      }
      if (events.kmCompleted) {
        this._pushCue('km')
      }
      if (this.elapsedSec > 0 && this.elapsedSec % (300 * this.speedFactor) < this.speedFactor) {
        this._pushCue('time')
      }
    },

    _pushCue(trigger, customText) {
      const used = new Set(this.cueLog.map((c) => c.cueId))
      const bucket = this.cues.filter((c) => c.trigger === trigger && !used.has(c.id))
      const pick = customText
        ? { id: `cue_auto_${Date.now()}`, trigger, text: customText }
        : bucket[0] || this.cues.find((c) => c.trigger === trigger && !used.has(c.id))
      if (!pick) return
      this.cueLog.push({
        id: `cue_log_${this.cueLog.length + 1}`,
        cueId: pick.id,
        trigger: pick.trigger,
        text: customText || pick.text,
        at: this.elapsedSec,
      })
    },

    togglePause() {
      if (!this.simulator) return
      this.simulator.toggle()
      this.status = this.simulator.status
      if (this.status === 'paused') this._pushCue('intensity', '已手动暂停，计时与距离统计都已冻结。')
    },

    markLap() {
      if (!this.simulator) return
      this.simulator.markLap()
      this._pushCue('km', `已记录第 ${this.simulator.laps.length} 个分段。`)
    },

    finish() {
      if (!this.simulator) return null
      this._stopTimer()
      const stats = this.simulator.finish()
      this.status = 'finished'
      this._pushCue('finish')
      this.record = {
        id: `rec_${Date.now().toString(36)}`,
        sessionId: this.session.id,
        sessionTitle: this.session.title,
        week: this.session.week,
        date: new Date().toISOString().slice(0, 10),
        type: this.session.type,
        ...stats,
      }
      save('lastRecord', this.record)
      return this.record
    },

    /** 提交反馈 → 规则引擎计算调整 → 生成四段式总结 */
    async submitFeedback(feedback) {
      const planStore = usePlanStore()
      const historyStore = useHistoryStore()
      const profileStore = useProfileStore()
      this.feedback = feedback

      const plan = planStore.plan
      const recentRecords = historyStore.records.slice(0, 4).map((r) => ({
        ...r,
        feedback: r.feedback,
      }))
      const longest30dKm = Math.max(
        this.record?.actualDistanceKm || 0,
        ...historyStore.records.map((r) => r.actualDistanceKm || 0),
        0,
      )

      // 距目标日期天数（用于 P8 减量 / P9 比赛周 / P10 风险复核）
      let daysToRace = null
      const targetDate = profileStore.draft?.targetDate
      if (targetDate) {
        daysToRace = Math.ceil((new Date(targetDate) - new Date()) / 864e5)
      }

      let adjustments = []
      let safetyNotice = null
      // 先标记课次完成（可能解锁下一周），再计算调整，保证写回的新计划包含最新状态
      if (this.session) planStore.markSessionDone(this.session.id, 'done')
      if (plan) {
        const result = planStore.computeAdjust({
          record: this.record,
          feedback,
          recentRecords,
          longest30dKm: longest30dKm || 8,
          daysToRace,
        })
        adjustments = result.adjustments
        safetyNotice = result.safetyNotice
      }
      this.lastAdjustments = adjustments
      this.safetyNotice = safetyNotice

      this.summary = buildSummary({
        session: this.session,
        record: this.record,
        feedback,
        adjustments,
      })
      this.summary.text = fallbackSummary({ record: this.record, feedback })
      this.summary.source = 'engine'

      historyStore.add({
        ...this.record,
        feedback,
        summary: this.summary,
        adjustments,
      })

      return { summary: this.summary, adjustments, safetyNotice }
    },

    reset() {
      this._stopTimer()
      this.session = null
      this.simulator = null
      this.cues = []
      this.cueLog = []
      this.elapsedSec = 0
      this.distanceKm = 0
      this.currentPace = 0
      this.averagePace = 0
      this.zoneSeconds = {}
      this.status = 'idle'
      this.record = null
      this.feedback = null
      this.summary = null
      this.lastAdjustments = []
      this.safetyNotice = null
    },
  },
})
