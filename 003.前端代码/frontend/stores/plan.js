import { defineStore } from 'pinia'
import { load, save } from '../services/storage.js'
import { confirmPlanApi, currentPlanApi, generateAiPlanApi, createAiPlanTaskApi, getAiPlanTaskApi, decideAiAdjustmentApi } from '../services/authApi.js'

function normalizePlanCopy(plan) {
  if (!plan) return plan
  ;(plan.weeks || []).forEach((week) => {
    ;(week.sessions || []).forEach((session) => {
      session.title = String(session.title || '')
        .replace(/\s*[（(]保守版[）)]/g, '')
        .replace(/比赛配速/g, '专项节奏')
      if (session.description === '全程轻松，保持能交谈。超过计划距离不停是本周唯一任务。') {
        session.description = '全程保持轻松和呼吸稳定。按计划距离持续完成，是本周的主要任务。'
      }
      if (session.description === '全程能正常说话的强度。目标是积累有氧基础，不是训练。') {
        session.description = '全程保持呼吸从容、动作放松。目标是积累有氧基础，不追求速度。'
      }
      session.description = String(session.description || '')
        .replace(/能够?自如交谈|能持续对话|能正常说话|能说完整句但不能唱歌|能对话/g, '保持呼吸稳定、动作放松')
        .replace(/能说短句|只能说短句|只能蹦词/g, '保持受控用力')
      session.adaptationNote = String(session.adaptationNote || '')
        .replace(/请严格\s*/g, '')
        .replace(/务必\s*/g, '')
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

function buildZoneDistribution(weeks) {
  const totals = new Map()
  let total = 0
  ;(weeks || []).forEach((week) => {
    ;(week.sessions || []).forEach((session) => {
      const level = ['interval', 'tempo', 'race'].includes(session.type)
        ? session.type
        : session.type === 'strength' ? 'strength' : 'easy'
      const amount = Number(session.distanceKm || session.durationMin || 0)
      totals.set(level, (totals.get(level) || 0) + amount)
      total += amount
    })
  })
  if (!total) return [{ level: 'easy', name: '基础', ratio: 1 }]
  return [...totals.entries()].map(([level, amount]) => ({
    level,
    name: level === 'easy' ? '基础' : level === 'strength' ? '力量' : level === 'race' ? '专项' : '质量',
    ratio: amount / total,
  }))
}

function normalizeAiPlan(plan, profile) {
  const easyPace = Number(profile.easyPace || 420)
  const goalPace = Number(profile.targetPace || easyPace)

  const normalized = normalizePlanCopy({
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
            ? {
                ...session.intensity,
                paceLow: Number(session.intensity.paceLow || paceLow),
                paceHigh: Number(session.intensity.paceHigh || paceHigh),
                rpe: Array.isArray(session.intensity.rpe)
                  && session.intensity.rpe.length >= 2
                  && Number(session.intensity.rpe[0]) > 0
                  && Number(session.intensity.rpe[1]) >= Number(session.intensity.rpe[0])
                  ? [Math.max(1, Number(session.intensity.rpe[0])), Math.max(1, Number(session.intensity.rpe[1]))]
                  : (session.type === 'interval' ? [6, 8] : session.type === 'tempo' || session.type === 'race' ? [5, 7] : [2, 4]),
                effort: session.intensity.effort || session.intensity.level || (isEasyEffort ? '轻松' : '受控'),
                hrZone: session.intensity.hrZone || '—',
              }
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
  if (!Array.isArray(normalized.zoneDistribution) || !normalized.zoneDistribution.length) {
    normalized.zoneDistribution = buildZoneDistribution(normalized.weeks)
  }
  return normalized
}

/** 训练计划（生成 → 确认 → 执行中 → 调整） */
export const usePlanStore = defineStore('plan', {
  state: () => ({
    plan: normalizePlanCopy(load('plan', null)),
    generating: false,
    /** 待确认的调整集合 */
    pendingAdjustments: [],
    pendingSafetyNotice: null,
    /** 本次 AI 判断的范围、复核点和触发原因 */
    pendingAdjustmentMeta: null,
    /** AI 调整产出的新计划（用户采纳后写回） */
    pendingPlan: null,
    remoteAdjustmentId: null,
    latestAdjustmentSummary: load('latestAdjustmentSummary', null),
    /** 调整留痕 */
    adjustmentLogs: load('adjustmentLogs', []),
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
    async hydrateFromServer(token, profile = {}) {
      if (!token || import.meta.env?.MODE === 'test') return this.plan
      const result = await currentPlanApi(token)
      if (!result.plan) {
        this.plan = null
        this.confirmed = false
        save('plan', null)
        save('planConfirmed', false)
        return null
      }
      this.plan = normalizeAiPlan(result.plan, profile)
      this.confirmed = result.plan.status === 'active'
      save('plan', this.plan)
      save('planConfirmed', this.confirmed)
      return this.plan
    },

    async generate(profile, options = {}) {
      this.generating = true
      const token = load('authToken', null)
      if (!token) {
        this.generating = false
        throw new Error('登录已失效，请重新登录')
      }
      try {
        const requestProfile = { ...profile, ...options }
        let result
        if (import.meta.env?.MODE === 'test') {
          result = await generateAiPlanApi(token, requestProfile)
        } else {
          const task = await createAiPlanTaskApi(token, requestProfile)
          if (task.status === 'goal_adjustment_recommended' || task.status === 'blocked') {
            result = task
          } else {
            const deadline = Date.now() + 180000
            while (Date.now() < deadline) {
              const status = await getAiPlanTaskApi(token, task.taskId)
              if (status.status === 'succeeded') {
                result = status.result
                break
              }
              if (status.status === 'failed') throw new Error(status.error || 'AI 计划生成失败，请稍后重试')
              await new Promise((resolve) => window.setTimeout(resolve, 800))
            }
            if (!result) throw new Error('AI 计划生成超时，请稍后重试')
          }
        }
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
        this.latestAdjustmentSummary = null
        save('plan', normalized)
        save('planConfirmed', false)
        save('latestAdjustmentSummary', null)
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
      advanceCurrentWeek(this.plan)
      save('plan', this.plan)
    },

    /** 用户决策：采纳 / 保持原计划 */
    async decideAdjustments(decision) {
      if (!this.plan) return
      const token = load('authToken', null)
      const remoteId = this.remoteAdjustmentId
      if (token && remoteId) {
        await decideAiAdjustmentApi(token, remoteId, decision)
      }
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

      // 采纳时把通过校验的 AI 调整写回 —— 闭环的「计划真的变了」
      if (decision === 'accepted' && this.pendingPlan) {
        const completedIds = new Set(this.plan.weeks.flatMap((week) => week.sessions).filter((session) => session.status === 'done').map((session) => session.id))
        advanceCurrentWeek(this.pendingPlan)
        this.plan = normalizePlanCopy(this.pendingPlan)
        this.plan.weeks.forEach((week) => week.sessions.forEach((session) => {
          if (completedIds.has(session.id)) session.status = 'done'
        }))
        advanceCurrentWeek(this.plan)
        save('plan', this.plan)
      }
      this.pendingAdjustments = []
      this.pendingSafetyNotice = null
      this.pendingAdjustmentMeta = null
      this.pendingPlan = null
      this.remoteAdjustmentId = null
    },

    reset() {
      this.plan = null
      this.confirmed = false
      this.latestAdjustmentSummary = null
      this.pendingPlan = null
      this.remoteAdjustmentId = null
      this.pendingAdjustments = []
      this.pendingAdjustmentMeta = null
      save('plan', null)
      save('planConfirmed', false)
      save('latestAdjustmentSummary', null)
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

function advanceCurrentWeek(plan) {
  if (!plan?.weeks?.length) return
  let currentWeek = Number(plan.currentWeek || 1)
  while (currentWeek < Number(plan.totalWeeks || plan.weeks.length)) {
    const current = plan.weeks.find((week) => Number(week.week) === currentWeek)
    if (!current || current.sessions.some((session) => session.status === 'pending')) break
    currentWeek += 1
  }
  plan.currentWeek = currentWeek
}
