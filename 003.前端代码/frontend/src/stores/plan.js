import { defineStore } from 'pinia'
import { generatePlan } from '../domain/engine/planEngine.js'
import { computeAdjustments } from '../domain/engine/adjustEngine.js'
import { load, save } from '../services/storage.js'
import { DEMO_ADJUSTMENT_LOGS } from '../data/demoSeed.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 训练计划（生成 → 确认 → 执行中 → 调整） */
export const usePlanStore = defineStore('plan', {
  state: () => ({
    plan: load('plan', null),
    generating: false,
    /** 待确认的调整集合 */
    pendingAdjustments: [],
    pendingSafetyNotice: null,
    /** 规则引擎产出的新计划（用户采纳后写回） */
    pendingPlan: null,
    /** 调整留痕 */
    adjustmentLogs: load('adjustmentLogs', DEMO_ADJUSTMENT_LOGS),
    /** 用户是否已确认计划 */
    confirmed: load('planConfirmed', false),
  }),

  getters: {
    hasPlan: (s) => Boolean(s.plan),
    status: (s) => (s.plan ? s.plan.status : 'none'),
    currentWeek: (s) => s.plan?.weeks?.[(s.plan.currentWeek || 1) - 1] || null,
    todaySessions: (s) => s.plan?.weeks?.[(s.plan.currentWeek || 1) - 1]?.sessions || [],
    pendingSessions() {
      return this.todaySessions.filter((s) => s.status === 'pending')
    },
    /** 未来待执行的课次（按周/序号排序） */
    upcomingSessions() {
      const list = []
      ;(this.plan?.weeks || []).forEach((w) =>
        w.sessions.forEach((s) => {
          if (s.status === 'pending') list.push({ ...s, weekPlan: w })
        }),
      )
      return list
    },
    totalPlannedKm: (s) =>
      s.plan ? s.plan.weeks.reduce((a, w) => a + w.targetKm, 0) : 0,
  },

  actions: {
    async generate(profile, options = {}) {
      this.generating = true
      await sleep(900) // 模拟计划生成耗时（PRD §8：计划生成 < 20s）
      const result = generatePlan(profile, options)
      this.generating = false

      if (result.blocked) {
        this.plan = null
        save('plan', null)
        return result
      }

      this.plan = result
      this.confirmed = false
      save('plan', result)
      save('planConfirmed', false)
      return result
    },

    confirmPlan() {
      if (!this.plan) return
      this.plan.status = 'active'
      this.confirmed = true
      save('plan', this.plan)
      save('planConfirmed', true)
    },

    /** 课次执行完成后标记；本周课次全部完成时解锁下一周（PRD §H3 按周解锁） */
    markSessionDone(sessionId, status = 'done') {
      if (!this.plan) return
      this.plan.weeks.forEach((w) =>
        w.sessions.forEach((s) => {
          if (s.id === sessionId) s.status = status
        }),
      )
      const current = this.plan.weeks.find((w) => w.week === this.plan.currentWeek)
      if (current && current.sessions.every((s) => s.status !== 'pending')) {
        this.plan.currentWeek = Math.min(this.plan.currentWeek + 1, this.plan.totalWeeks)
      }
      save('plan', this.plan)
    },

    /** 计算调整集合（写入闭环） */
    computeAdjust({ record, feedback, recentRecords, longest30dKm, daysToRace, weeksSinceBreak = 0 }) {
      const result = computeAdjustments({
        plan: this.plan,
        record,
        feedback,
        recentRecords,
        longest30dKm,
        daysToRace,
        weeksSinceBreak,
      })
      this.pendingAdjustments = result.adjustments
      this.pendingSafetyNotice = result.safetyNotice
      this.pendingPlan = result.plan
      return result
    },

    /** 用户决策：采纳 / 保持原计划 */
    decideAdjustments(decision) {
      if (!this.plan) return
      const items = this.pendingAdjustments.map((a) => ({
        label: a.target.label,
        beforeText: describeBefore(a),
        afterText: describeAfter(a),
        reasonText: a.reasonText,
        reasonCode: a.reasonCode,
      }))
      this.adjustmentLogs = [
        {
          id: `adj_${Date.now().toString(36)}`,
          date: new Date().toISOString().slice(0, 10),
          reasonCodes: this.pendingAdjustments.map((a) => a.reasonCode),
          count: this.pendingAdjustments.length,
          decision,
          items,
        },
        ...this.adjustmentLogs,
      ]
      save('adjustmentLogs', this.adjustmentLogs)

      // 采纳时把规则引擎算出的新计划写回 —— 闭环的「计划真的变了」
      if (decision === 'accepted' && this.pendingPlan) {
        this.plan = this.pendingPlan
        save('plan', this.plan)
      }
      this.pendingAdjustments = []
      this.pendingSafetyNotice = null
      this.pendingPlan = null
    },

    reset() {
      this.plan = null
      this.confirmed = false
      this.pendingAdjustments = []
      save('plan', null)
      save('planConfirmed', false)
    },
  },
})

function describeBefore(a) {
  if (a.type === 'MODIFY_WEEK') return `${a.before.targetKm}km / 周`
  if (!a.before || !a.before.distanceKm && a.before.distanceKm !== 0) return '—'
  const pace = a.before.pace && a.before.pace[1] ? ` @ ${fmt(a.before.pace)}` : ''
  return `${a.before.distanceKm}km${pace}`
}

function describeAfter(a) {
  if (a.type === 'MODIFY_WEEK') return `${a.after.targetKm}km / 周`
  if (!a.after || !a.after.distanceKm && a.after.distanceKm !== 0) return '—'
  const pace = a.after.pace && a.after.pace[1] ? ` @ ${fmt(a.after.pace)}` : ''
  return `${a.after.distanceKm}km${pace}`
}

function fmt(pace) {
  const m = Math.floor(pace[0] / 60)
  const s = Math.round(pace[0] % 60)
  return `${m}'${String(s).padStart(2, '0')}"`
}
