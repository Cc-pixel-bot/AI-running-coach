import { defineStore } from 'pinia'
import { computeAdjustments } from '../domain/engine/adjustEngine.js'
import { load, save } from '../services/storage.js'
import { DEMO_ADJUSTMENT_LOGS } from '../data/demoSeed.js'
import { confirmPlanApi, generateAiPlanApi } from '../services/authApi.js'

function normalizePlanCopy(plan) {
  if (!plan) return plan
  ;(plan.weeks || []).forEach((week) => {
    ;(week.sessions || []).forEach((session) => {
      session.title = String(session.title || '').replace(/\s*[（(]保守版[）)]/g, '')
      if (session.description === '全程轻松，保持能交谈。超过计划距离不停是本周唯一任务。') {
        session.description = '全程保持轻松和呼吸稳定。按计划距离持续完成，是本周的主要任务。'
      }
      if (session.description === '全程能正常说话的强度。目标是积累有氧基础，不是训练。') {
        session.description = '全程保持呼吸从容、动作放松。目标是积累有氧基础，不追求速度。'
      }
      if (session.mainRun) {
        session.mainRun = {
          ...session.mainRun,
          type: session.type,
          distanceKm: Number(session.distanceKm || 0),
          durationMin: Number(session.durationMin || 0),
        }
      }
      if (session.preRunWarmup?.exercises) session.warmup = session.preRunWarmup.exercises
      if (session.postRunStretch?.exercises) session.cooldown = session.postRunStretch.exercises
    })
  })
  return plan
}

function normalizeExerciseList(value, kind) {
  const defaults = kind === 'warmup'
    ? [
        { name: '快走热身', dose: '3分钟', points: '从轻松步行逐渐进入跑步状态' },
        { name: '腿部动态活动', dose: '各侧10次', points: '动作轻柔，不做弹震和疼痛范围外的动作' },
      ]
    : [
        { name: '慢走放松', dose: '3分钟', points: '让呼吸和心率逐步恢复' },
        { name: '小腿与大腿静态拉伸', dose: '每侧15–20秒×2', points: '保持自然呼吸，不压到疼痛' },
      ]
  const list = Array.isArray(value) ? value : value ? [value] : []
  const normalized = list
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: `${kind}-${index + 1}`, name: item, dose: kind === 'warmup' ? '3分钟' : '每侧15–20秒×2', points: '' }
      }
      return {
        id: item?.id || `${kind}-${index + 1}`,
        name: item?.name || item?.title || `${kind === 'warmup' ? '动态热身' : '静态拉伸'}${index + 1}`,
        duration: item?.duration || item?.dose || (kind === 'warmup' ? '3分钟' : '每侧15–20秒×2'),
        instruction: item?.instruction || item?.points || item?.detail || '',
        dose: item?.dose || item?.duration || (kind === 'warmup' ? '3分钟' : '每侧15–20秒×2'),
        points: item?.points || item?.detail || item?.instruction || '',
      }
    })
    .filter((item) => item.name)
  return normalized.length ? normalized : defaults.map((item, index) => ({ ...item, id: `${kind}-${index + 1}` }))
}

function normalizeExerciseSection(value, kind, fallbackTitle, fallbackDuration) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const exercises = normalizeExerciseList(source.exercises ?? value, kind)
  return {
    title: source.title || fallbackTitle,
    duration: Number(source.duration || fallbackDuration),
    exercises,
  }
}

function normalizeAdaptationSummary(summary) {
  if (Array.isArray(summary) && summary.length) return summary
  if (typeof summary === 'string' && summary.trim()) {
    return [{ icon: 'psychology', title: '个性化安排', text: summary.trim() }]
  }
  return [{ icon: 'psychology', title: '个性化安排', text: '根据跑者档案、目标成绩和训练模板生成本计划。' }]
}

function normalizeAiPlan(plan, profile) {
  const easyPace = Number(profile.easyPace || 420)
  const goalPace = Number(profile.targetPace || easyPace)

  return normalizePlanCopy({
    ...plan,
    goalPace,
    goalTotalSec: Number(plan.goalTotalSec || profile.targetTotalSec || 0),
    totalWeeks: Number(plan.totalWeeks || 8),
    currentWeek: Number(plan.currentWeek || 1),
    status: plan.status || 'draft',
    adaptationSummary: normalizeAdaptationSummary(plan.adaptationSummary),
    weeks: (plan.weeks || []).map((week, weekIndex) => ({
      ...week,
      week: Number(week.week || weekIndex + 1),
      targetKm: Number(week.targetKm ?? week.totalKm ?? 0),
      typeName: week.phase || week.phaseName || '训练阶段',
      focus: week.focus || '完成本周训练安排',
      sessions: (week.sessions || []).map((session, sessionIndex) => {
        const isEasyEffort = ['easy', 'aerobic', 'recovery', 'long'].includes(session.type)
        const paceLow = isEasyEffort
          ? easyPace
          : goalPace
        const paceHigh = isEasyEffort
          ? easyPace + 20
          : goalPace + 10
        return {
          ...session,
          id: session.id || `w${week.week}s${sessionIndex + 1}`,
          week: Number(session.week || week.week),
          dayOffset: Number(session.dayOffset ?? sessionIndex * 2),
          dayLabel: session.dayLabel || `第${sessionIndex + 1}天`,
          status: session.status === 'done' || session.status === 'replaced' ? session.status : 'pending',
          distanceKm: Number(session.distanceKm || 0),
          durationMin: Number(session.durationMin || 0),
          intensity: typeof session.intensity === 'object'
            ? session.intensity
            : {
                level: session.intensity || '轻松',
                paceLow,
                paceHigh,
                hrZone: '—',
                effort: session.intensity || '轻松',
                rpe: session.type === 'interval' ? [6, 8] : session.type === 'tempo' || session.type === 'race' ? [5, 7] : [2, 4],
              },
          structure: typeof session.structure === 'object'
            ? {
                ...session.structure,
                pattern: session.structure.pattern || '热身 → 主体跑步 → 放松',
                warmupKm: Number(session.structure.warmupKm || 0),
                mainKm: Number(session.structure.mainKm ?? session.distanceKm ?? 0),
                cooldownKm: Number(session.structure.cooldownKm || 0),
                mainLevel: session.structure.mainLevel || session.type,
              }
            : {
                pattern: session.structure || '热身 → 主体跑步 → 放松',
                warmupKm: 0,
                mainKm: Number(session.distanceKm || 0),
                cooldownKm: 0,
                mainLevel: session.type,
              },
          preRunWarmup: normalizeExerciseSection(session.preRunWarmup ?? session.warmup, 'warmup', '练前动态激活', 5),
          mainRun: session.mainRun || {
            type: session.type,
            distanceKm: Number(session.distanceKm || 0),
            durationMin: Number(session.durationMin || 0),
            pace: null,
            structure: session.structure?.pattern || session.structure || '主体跑步训练',
          },
          postRunStretch: normalizeExerciseSection(session.postRunStretch ?? session.cooldown, 'cooldown', '练后静态拉伸', 5),
          warmup: normalizeExerciseSection(session.preRunWarmup ?? session.warmup, 'warmup', '练前动态激活', 5).exercises,
          cooldown: normalizeExerciseSection(session.postRunStretch ?? session.cooldown, 'cooldown', '练后静态拉伸', 5).exercises,
          exercises: Array.isArray(session.exercises) ? session.exercises : [],
        }
      }),
    })),
  })
}

/** 训练计划（生成 → 确认 → 执行中 → 调整） */
export const usePlanStore = defineStore('plan', {
  state: () => ({
    plan: normalizePlanCopy(load('plan', null)),
    generating: false,
    /** 待确认的调整集合 */
    pendingAdjustments: [],
    pendingSafetyNotice: null,
    /** AI 调整产出的新计划（用户采纳后写回） */
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
      const token = load('authToken', null)
      if (!token) {
        this.generating = false
        throw new Error('登录已失效，请重新登录')
      }
      try {
        const result = await generateAiPlanApi(token, { ...profile, ...options })
        if (result.status === 'goal_adjustment_recommended') {
          this.generating = false
          return { goalRecommendation: result.goalRecommendation }
        }
        if (result.status === 'blocked' || result.blocked) {
          this.plan = null
          save('plan', null)
          this.generating = false
          return { blocked: true, reason: 'SCREENING_BLOCK', message: result.message }
        }
        const normalized = normalizeAiPlan(result.plan, profile)
        this.plan = normalized
        this.confirmed = false
        save('plan', normalized)
        save('planConfirmed', false)
        this.generating = false
        return normalized
      } catch (error) {
        this.generating = false
        this.plan = null
        save('plan', null)
        throw error
      }
    },

    async confirmPlan() {
      if (!this.plan) return
      const token = load('authToken', null)
      if (token) await confirmPlanApi(token)
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
        this.plan = normalizePlanCopy(this.pendingPlan)
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
