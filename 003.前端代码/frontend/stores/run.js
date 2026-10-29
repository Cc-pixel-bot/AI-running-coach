import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { GpsService } from '../services/gpsService.js'
import { GpsSimulator } from '../services/gpsSimulator.js'
import { buildCuePack } from '../services/voiceCoach.js'
import { buildSummary, fallbackSummary } from '../domain/engine/summaryBuilder.js'
import { usePlanStore } from './plan.js'
import { useHistoryStore } from './history.js'
import { save } from '../services/storage.js'
import { load } from '../services/storage.js'
import { saveFeedbackApi, saveRunApi, completeRunApi, requestAiAdjustmentApi } from '../services/authApi.js'

/** 训练执行：GPS 记录 → 结束 → 反馈 → AI 总结与计划调整 */
export const useRunStore = defineStore('run', {
  state: () => ({
    session: null,
    simulator: null,
    gpsError: '',
    cues: [],
    cueLog: [],
    elapsedSec: 0,
    distanceKm: 0,
    currentPace: 0,
    averagePace: 0,
    currentZone: 'easy',
    pauseCount: 0,
    /** 轨迹点（响应式镜像，避免 markRaw 的模拟器对象无法触发视图更新） */
    trackPoints: [],
    zoneSeconds: {},
    status: 'idle', // idle | running | paused | finished
    speedFactor: 1,
    record: null,
    feedback: null,
    summary: null,
    aiSummaryText: '',
    summarySource: 'engine',
    lastAdjustments: [],
    safetyNotice: null,
    adjustmentId: null,
    adjustmentDecision: null,
    adjustmentScope: null,
    adjustmentEpisode: null,
    followUp: null,
    serverSavePromise: null,
    /** 当前课次的练前/练后完成状态，反馈提交后仍保留并可继续修改 */
    prepChecklist: {},
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
      this.startedAt = new Date().toISOString()
      this.speedFactor = speedFactor
      this.gpsError = ''
      const isTestRun = import.meta.env?.MODE === 'test'
      const gps = isTestRun
        ? new GpsSimulator(session, { speedFactor })
        : new GpsService(session, {
        onError: (message) => {
          this.gpsError = message
          this.status = 'error'
          this._stopTimer()
        },
        })
      this.simulator = markRaw(gps)
      this.cues = buildCuePack(session, { goalPaceSec: session?.intensity ? session.intensity.paceLow : 0 })
      this.cueLog = []
      this.record = null
      this.feedback = null
      this.summary = null
      this.aiSummaryText = ''
      this.lastAdjustments = []
      this.safetyNotice = null
      this.adjustmentDecision = null
      this.adjustmentScope = null
      this.adjustmentEpisode = null
      this.followUp = null
      this.trackPoints = []
      this.pauseCount = 0
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
      const events = sim.tick()
      this.elapsedSec = sim.elapsedSec
      this.distanceKm = sim.distanceKm
      this.currentPace = sim.currentPace
      this.averagePace = sim.averagePace
      this.currentZone = sim.currentZone
      this.pauseCount = sim.pauseCount
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
        startedAt: this.startedAt || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        type: this.session.type,
        ...stats,
      }
      save('lastRecord', this.record)
      this.persistRecordToServer()
      return this.record
    },

    async persistRecordToServer() {
      const token = load('authToken', null)
      if (token && this.record && !this.record.serverId && import.meta.env?.MODE !== 'test') {
        this.serverSavePromise = saveRunApi(token, this.record)
          .then((result) => { this.record = { ...this.record, serverId: result.recordId } })
          .catch((error) => { this.gpsError = error.message || '训练记录保存失败，稍后可重试' })
      }
      if (this.serverSavePromise) await this.serverSavePromise
      return this.record?.serverId || null
    },

    /** 提交反馈 → 变化检测 → AI 调整评估 → 生成训练总结 */
    async submitFeedback(feedback) {
      const planStore = usePlanStore()
      const historyStore = useHistoryStore()
      this.feedback = feedback

      const token = load('authToken', null)
      if (this.serverSavePromise) await this.serverSavePromise
      if (token && import.meta.env?.MODE !== 'test' && this.record?.serverId) {
        await saveFeedbackApi(token, this.record.serverId, feedback)
      }

      // 反馈页允许修正实际距离与用时，写回本次记录，供当前训练页和训练总结使用。
      if (this.record) {
        const actualDistanceKm = Number(feedback.actualDistanceKm)
        const actualDurationSec = Number(feedback.actualDurationMin) * 60
        const avgPace = actualDistanceKm > 0 && actualDurationSec > 0
          ? Math.round(actualDurationSec / actualDistanceKm)
          : this.record.avgPace
        this.record = {
          ...this.record,
          actualDistanceKm: Number.isFinite(actualDistanceKm) ? actualDistanceKm : this.record.actualDistanceKm,
          actualDurationSec: Number.isFinite(actualDurationSec) ? actualDurationSec : this.record.actualDurationSec,
          avgPace,
        }
      }

      let adjustments = []
      let safetyNotice = null
      if (planStore.plan && token && this.record?.serverId) {
          const result = await requestAiAdjustmentApi(token, this.record.serverId)
          adjustments = (result.adjustments || []).map((item) => ({
            ...item,
            target: {
              ...item.target,
              label: (() => {
                const target = planStore.plan?.weeks?.flatMap((week) => week.sessions).find((session) => session.id === item.target?.sessionId)
                return target ? `第${target.week}周 · ${target.dayLabel} · ${target.title}` : '后续训练'
              })(),
            },
          }))
          safetyNotice = result.safetyNotice || null
          this.aiSummaryText = result.summary || ''
          this.summarySource = result.source || 'ai'
          this.adjustmentId = result.adjustmentId || null
          this.adjustmentDecision = result.decision || (adjustments.length ? 'adjust' : 'keep')
          this.adjustmentScope = result.scope || (adjustments.length ? 'micro' : 'none')
          this.adjustmentEpisode = result.adjustmentEpisode || null
          this.followUp = result.followUp || null
          planStore.latestAdjustmentSummary = {
            summary: result.summary || '',
            followUp: this.followUp,
            date: new Date().toISOString().slice(0, 10),
          }
          save('latestAdjustmentSummary', planStore.latestAdjustmentSummary)
          planStore.remoteAdjustmentId = this.adjustmentId
          const pendingPlan = JSON.parse(JSON.stringify(planStore.plan))
          adjustments.forEach((item) => {
            const target = pendingPlan.weeks.flatMap((week) => week.sessions).find((session) => session.id === item.target.sessionId)
            if (!target) return
            Object.assign(target, item.after || {})
            target.status = 'replaced'
          })
          planStore.pendingPlan = pendingPlan
          planStore.pendingAdjustments = adjustments
          planStore.pendingSafetyNotice = safetyNotice
          planStore.pendingAdjustmentMeta = {
            decision: this.adjustmentDecision,
            scope: this.adjustmentScope,
            triggerReasons: result.triggerReasons || [],
            adjustmentEpisode: this.adjustmentEpisode,
            followUp: this.followUp,
          }
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
      if (this.aiSummaryText) {
        this.summary.text = this.aiSummaryText
        this.summary.source = this.summarySource
      } else {
        this.summary.source = 'local-fallback'
      }

      historyStore.add({
        ...this.record,
        feedback,
        summary: this.summary,
        adjustments,
      })

      // 反馈提交也视为本次训练完成的兜底入口，保证用户从反馈页返回计划时状态一致。
      await this.completeTraining()

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
      this.aiSummaryText = ''
      this.summarySource = 'engine'
      this.lastAdjustments = []
      this.safetyNotice = null
      this.adjustmentId = null
      this.adjustmentDecision = null
      this.adjustmentScope = null
      this.adjustmentEpisode = null
      this.followUp = null
      this.serverSavePromise = null
      this.startedAt = null
      this.gpsError = ''
      this.prepChecklist = {}
    },

    async completeTraining() {
      const token = load('authToken', null)
      if (token && this.record?.serverId && import.meta.env?.MODE !== 'test') {
        await completeRunApi(token, this.record.serverId)
      }
      if (this.session) usePlanStore().markSessionDone(this.session.id, 'done')
      return this.record
    },
  },
})
