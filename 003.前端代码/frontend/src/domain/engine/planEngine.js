/**
 * 计划生成引擎 —— PRD v1.2 §B2「计划生成引擎（8 步）」。
 *
 * 设计原则（PRD §2.2）：
 *  - 安全闸门优先：筛查未通过 → 不生成计划
 *  - 数值全部由引擎算出，LLM/文案层只负责解释，不参与计算
 *  - 同一周内强度与总量不同时推进（WA Advanced 原文）
 *  - 单次长距离 ≤ 近 30 天最长距离 × 1.1（Frandsen 2025 BJSM）
 */
import { TEMPLATES, TEMPLATES_BY_GOAL, QUALITY_SESSION_META } from '../templates/trainingTemplates.js'
import { INTENSITY, paceRangeOf } from '../constants/intensity.js'
import { evaluateScreening } from '../constants/screening.js'
import { runReachabilityChecks } from './reachability.js'
import { formatPace, estimateDurationSec } from '../utils/pace.js'
import { round, clamp } from '../utils/number.js'
import { COACH_QUOTES, STRENGTH_LIBRARY, INJURY_STRENGTH_KEY, WARMUP_LIBRARY, COOLDOWN_LIBRARY } from '../../data/exercises.js'

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const PLAN_TEMPLATE_REVISION = 3

/** 默认周内排课：周二轻松 / 周四质量 / 周六长距离 / 周日力量 */
const DEFAULT_SCHEDULE = {
  easy: { dayOffset: 2, label: '周二' },
  quality: { dayOffset: 4, label: '周四' },
  long: { dayOffset: 6, label: '周六' },
  strength: { dayOffset: 7, label: '周日' },
}

/** 各课型占周跑量的权重（合计 1） */
const VOLUME_WEIGHTS = { easy: 0.28, quality: 0.39, long: 0.33 }

/**
 * 目标配速 P（秒/km）。
 * 半马/全马无实测成绩时，用 WA 方法：5km 平均配速 +25~35 秒/km。
 */
export function computeGoalPace(profile) {
  const distanceKm = { '5K': 5, '10K': 10, HM: 21.0975, MARATHON: 42.195 }[profile.targetDistance] || 10

  if (profile.targetPace) return { pace: profile.targetPace, total: profile.targetPace * distanceKm, derived: 'user' }

  if (profile.bestHmPace && profile.targetDistance === 'HM') {
    return { pace: profile.bestHmPace, total: profile.bestHmPace * distanceKm, derived: 'profile' }
  }
  if (profile.bestMarPace && profile.targetDistance === 'MARATHON') {
    return { pace: profile.bestMarPace, total: profile.bestMarPace * distanceKm, derived: 'profile' }
  }
  if (profile.best10kPace && profile.targetDistance === '10K') {
    return { pace: profile.best10kPace, total: profile.best10kPace * distanceKm, derived: 'profile' }
  }
  if (profile.best5kPace) {
    // WA 半马计划 p.3：5km 平均配速 + 25–35 秒/km 估算长距离配速
    const pace = profile.best5kPace + 30
    return { pace, total: pace * distanceKm, derived: 'wa_estimate' }
  }
  const pace = profile.easyPace || 420
  return { pace, total: pace * distanceKm, derived: 'fallback' }
}

/** 模板选择：目标距离 + 距目标日期周数 + 当前水平 */
export function selectTemplate(profile, options = {}) {
  if (options.templateId && TEMPLATES[options.templateId]) return TEMPLATES[options.templateId]
  const candidates = TEMPLATES_BY_GOAL[profile.targetType] || ['T10-8W']
  if (candidates.length === 1) return TEMPLATES[candidates[0]]

  // 有比赛且剩余时间不足 → 选赛前压缩模板
  if (profile.hasRace && profile.targetDate) {
    const weeksLeft = Math.ceil((new Date(profile.targetDate) - new Date()) / (7 * 864e5))
    if (weeksLeft <= 6 && candidates.includes('T10-6W')) return TEMPLATES['T10-6W']
  }
  return TEMPLATES[candidates[0]]
}

/**
 * 起始周跑量（PRD §B2 步骤 4）：
 *   档案周跑量 × 0.9；有伤病 × 0.85；可训练天数 < 3 × 0.9；再对齐模板首周目标。
 */
export function computeStartWeeklyKm(profile) {
  let base = (profile.weeklyKm || 20) * 0.9
  if ((profile.injuries || []).some((i) => i.active)) base *= 0.85
  if ((profile.availableDays || 3) < 3) base *= 0.9
  const rounded = Math.round(base)
  return clamp(rounded, 8, 60)
}

/**
 * 逐周跑量曲线（PRD §5.1 R1 / R4 + §B2 步骤 6）。
 * - 趋势线每周 ≤ +10%
 * - 每 3–4 周插入 1 个回撤周（−18%）
 * - 质量课类型变化的那一周，增幅折半（强度与总量不同时推进）
 * - 减量期总量指数下降（41–60%），强度与频次保持不变
 */
export function computeWeeklyVolumes(template, startKm) {
  const policy = template.volumePolicy
  const blueprint = template.blueprint
  const weeks = []
  let trend = startKm
  let peak = startKm
  let prevQuality = null
  const taperWeeks = blueprint.filter((w) => w.taper)

  blueprint.forEach((bp, index) => {
    const week = index + 1
    let targetKm

    if (index === 0) {
      targetKm = trend
    } else {
      const qualityChanged = bp.quality !== prevQuality
      const gain = qualityChanged ? policy.qualityChangeGain : policy.weeklyGain
      trend = round(trend * (1 + gain), 1)
      if (bp.stepBack) {
        targetKm = round(trend * (1 - policy.stepBackDrop), 1)
      } else {
        targetKm = trend
      }
    }

    if (bp.taper) {
      const taperIndex = taperWeeks.findIndex((w) => w.week === week)
      const factor = policy.taperFactors[Math.min(taperIndex, policy.taperFactors.length - 1)]
      targetKm = round(peak * factor, 1)
    } else if (!bp.taper) {
      peak = Math.max(peak, targetKm)
    }

    weeks.push({
      week,
      type: bp.phase,
      typeName: bp.phaseName,
      focus: bp.focus,
      quality: bp.quality,
      qualityPlan: bp.qualityPlan,
      stepBack: bp.stepBack,
      taper: bp.taper,
      targetKm: Math.max(policy.minWeeklyKm, round(targetKm, 1)),
      trendKm: round(trend, 1),
    })
    prevQuality = bp.quality
  })

  return weeks
}

/** 按可训练天数裁剪课次（PRD §B2 步骤 5 / §5.1 R7：默认 3 跑 + 1 力量） */
function buildWeekSchedule(availableDays) {
  const schedule = []
  if (availableDays <= 2) {
    // 2 跑 + 1 力量：保留质量课与长距离，取消第三跑
    schedule.push({ kind: 'quality', ...DEFAULT_SCHEDULE.quality })
    schedule.push({ kind: 'long', ...DEFAULT_SCHEDULE.long })
    schedule.push({ kind: 'strength', ...DEFAULT_SCHEDULE.strength })
  } else if (availableDays === 3) {
    // 3 跑 + 1 力量（经典平衡）
    schedule.push({ kind: 'easy', ...DEFAULT_SCHEDULE.easy })
    schedule.push({ kind: 'quality', ...DEFAULT_SCHEDULE.quality })
    schedule.push({ kind: 'long', ...DEFAULT_SCHEDULE.long })
    schedule.push({ kind: 'strength', ...DEFAULT_SCHEDULE.strength })
  } else if (availableDays === 4) {
    schedule.push({ kind: 'easy', ...DEFAULT_SCHEDULE.easy })
    schedule.push({ kind: 'quality', ...DEFAULT_SCHEDULE.quality })
    schedule.push({ kind: 'long', ...DEFAULT_SCHEDULE.long })
    schedule.push({ kind: 'strength', ...DEFAULT_SCHEDULE.strength })
    schedule.push({ kind: 'recovery', dayOffset: 5, label: '周五' })
  } else {
    schedule.push({ kind: 'easy', ...DEFAULT_SCHEDULE.easy })
    schedule.push({ kind: 'quality', ...DEFAULT_SCHEDULE.quality })
    schedule.push({ kind: 'long', ...DEFAULT_SCHEDULE.long })
    schedule.push({ kind: 'strength', ...DEFAULT_SCHEDULE.strength })
    schedule.push({ kind: 'recovery', dayOffset: 5, label: '周五' })
    schedule.push({ kind: 'easy', dayOffset: 1, label: '周一' })
  }
  return schedule
}

/** 伤病适配（PRD §5.4） */
function applyInjuryAdaptation(session, profile) {
  const active = (profile.injuries || []).filter((i) => i.active)
  if (!active.length) return session
  const notes = []

  active.forEach((injury) => {
    if (injury.part === '膝盖' && ['interval', 'race'].includes(session.level)) {
      notes.push('膝部不适 → 已取消下坡与跳跃内容')
    }
    if (injury.part === '小腿' && session.level === 'interval') {
      notes.push('小腿不适 → 已取消冲刺型间歇')
    }
    if (injury.part === '髂胫束' && session.type === 'long') {
      notes.push('髂胫束不适 → 长距离已改为平路')
    }
    if (injury.part === '足部' && session.type === 'long') {
      notes.push('足底不适 → 长距离缩短并加入足底放松')
    }
  })

  if (session.type === 'long' && active.some((i) => i.part === '膝盖')) {
    session.distanceKm = round(session.distanceKm * 0.8, 1)
    session.durationMin = Math.round(session.durationMin * 0.8)
    notes.push('长距离上限 −20%')
  }

  if (notes.length) {
    session.adaptationNote = `${session.adaptationNote || ''} ${notes.join('；')}。`
  }
  return session
}

/** 构造一节课 */
function buildSession({ kind, week, dayOffset, label, weekPlan, profile, goalPace, sessionIndex }) {
  const id = `w${week}s${sessionIndex}`
  const base = {
    id,
    week,
    dayOffset,
    dayLabel: label || DAY_LABELS[dayOffset - 1] || '',
    status: 'pending',
    weekType: weekPlan.type,
    weekTypeName: weekPlan.typeName,
  }

  if (kind === 'strength') {
    const injuryKey = (profile.injuries || []).find((i) => i.active && INJURY_STRENGTH_KEY[i.part])
    const exercises = STRENGTH_LIBRARY[injuryKey ? INJURY_STRENGTH_KEY[injuryKey.part] : 'base']
    return {
      ...base,
      type: 'strength',
      level: 'strength',
      title: '跑者专项力量 · 髋与核心稳定',
      distanceKm: 0,
      durationMin: 40,
      intensity: {
        level: 'strength',
        effort: '可控发力，动作优先',
        talkTest: '能完整说话',
        rpe: [5, 5],
        paceLow: 0,
        paceHigh: 0,
        hrZone: '—',
      },
      description:
        '40 分钟。髋外展与核心训练被证实可显著降低过度使用伤风险，是本产品为有伤病史用户强制保留的一课。',
      exercises: exercises.map((e) => ({ ...e })),
      adaptationNote: injuryKey
        ? `你自述${injuryKey.part}不适，本课已替换为针对性稳定训练（${exercises.map((e) => e.name).join('、')}）。`
        : '即使无伤病史也保留本课：髋/核心力量训练与 64% 更低的跑步相关过度使用伤风险相关。',
      coachQuote: COACH_QUOTES.strength,
    }
  }

  const level = kind === 'quality' ? weekPlan.quality : kind === 'long' ? 'long' : kind === 'recovery' ? 'recovery' : 'easy'
  const def = INTENSITY[level]
  const weight = kind === 'quality' ? VOLUME_WEIGHTS.quality : kind === 'long' ? VOLUME_WEIGHTS.long : VOLUME_WEIGHTS.easy

  let distanceKm = round(weekPlan.targetKm * weight, 1)
  let structure = null
  let title = ''
  let description = ''

  if (kind === 'quality') {
    const meta = QUALITY_SESSION_META[weekPlan.quality] || QUALITY_SESSION_META.tempo
    const qualityPlan = weekPlan.qualityPlan
    title = qualityPlan ? `${meta.title} · ${qualityPlan.title}` : `${meta.title} · ${weekPlan.focus}`
    structure = {
      warmupKm: round(distanceKm * 0.25, 1),
      mainKm: round(distanceKm * 0.5, 1),
      cooldownKm: round(distanceKm * 0.25, 1),
      warmupLevel: 'easy',
      mainLevel: level,
      cooldownLevel: 'easy',
      pattern: qualityPlan?.pattern || meta.structure,
    }
    description = `${qualityPlan?.description || meta.purpose}${weekPlan.stepBack ? '（回撤周仍保留质量课，强度不减。）' : ''}`
  } else if (kind === 'long') {
    title = '长距离跑 · 耐力打底'
    description = '全程轻松，保持能交谈。超过计划距离不停是本周唯一任务。'
  } else if (kind === 'recovery') {
    title = '恢复跑 · 主动恢复'
    description = '极轻松的一次跑，用于吸收前几周负荷。'
  } else {
    title = '轻松跑 · 有氧基础'
    description = '全程能正常说话的强度。目标是积累有氧基础，不是训练。'
  }

  const pace = paceRangeOf(level, goalPace, profile.targetDistance)
  const durationMin = Math.round(estimateDurationSec(distanceKm, (pace.low + pace.high) / 2) / 60)

  const session = {
    ...base,
    type: kind === 'quality' ? level : kind === 'long' ? 'long' : kind === 'recovery' ? 'recovery' : 'easy',
    level,
    title,
    distanceKm,
    durationMin,
    intensity: {
      level,
      effort: def.effort,
      talkTest: def.talkTest,
      rpe: def.rpe,
      paceLow: pace.low,
      paceHigh: pace.high,
      hrZone: def.hrZone,
    },
    description,
    structure,
    warmup: WARMUP_LIBRARY.filter((w) => w.applies.includes('all') || w.applies.includes(level)).map((w) => ({ ...w })),
    cooldown: COOLDOWN_LIBRARY.map((c) => ({ ...c })),
    adaptationNote: '',
    coachQuote: COACH_QUOTES[level] || COACH_QUOTES.easy,
  }

  return session
}

/**
 * 生成训练计划。
 * @param {object} profile 规范化后的跑者档案
 * @param {{templateId?:string}} options
 * @returns {object} plan
 */
export function generatePlan(profile, options = {}) {
  // —— 步骤 0：安全闸门 ——
  const screening = evaluateScreening(profile.screening || {})
  if (!screening.cleared) {
    return {
      blocked: true,
      screening,
      reason: 'SCREENING_BLOCK',
    }
  }

  // —— 步骤 1：选定模板 ——
  const template = selectTemplate(profile, options)

  // —— 步骤 2：计算 P ——
  const goal = computeGoalPace(profile)
  const goalPace = goal.pace

  // —— 步骤 3：可达性校验（需要先算出跑量曲线，故此处做两段式）——
  const startKm = computeStartWeeklyKm(profile)
  const weekVolumes = computeWeeklyVolumes(template, startKm)
  const reachability = runReachabilityChecks(
    { ...profile, targetPace: goalPace },
    { template, weeks: weekVolumes },
  )

  // —— 步骤 5：分配周内课次 ——
  const schedule = buildWeekSchedule(profile.availableDays || 3)
  const longCap = round((profile.longestRunKm || 8) * 1.1, 1) // R2 单次长距离上限

  const weeks = weekVolumes.map((weekPlan) => {
    const sessions = schedule.map((slot, index) =>
      buildSession({
        kind: slot.kind,
        week: weekPlan.week,
        dayOffset: slot.dayOffset,
        label: slot.label,
        weekPlan,
        profile,
        goalPace,
        sessionIndex: index + 1,
      }),
    )

    // R2：单次长距离上限
    sessions.forEach((s) => {
      if (s.type === 'long' && s.distanceKm > longCap) {
        const before = s.distanceKm
        s.distanceKm = longCap
        s.durationMin = Math.round(estimateDurationSec(longCap, (s.intensity.paceLow + s.intensity.paceHigh) / 2) / 60)
        s.adaptationNote = `单次长距离上限约束：${before}km → ${longCap}km（近 30 天最长 ${profile.longestRunKm}km × 1.1，Frandsen 2025 BJSM）。`
      }
    })

    // R5：单次时长上限（按 available_min）
    sessions.forEach((s) => {
      if (s.type !== 'strength' && s.durationMin > (profile.availableMin || 60)) {
        const factor = (profile.availableMin || 60) / s.durationMin
        s.distanceKm = round(s.distanceKm * factor, 1)
        s.durationMin = profile.availableMin || 60
        s.adaptationNote = `${s.adaptationNote || ''} 按单次可用时长 ${profile.availableMin || 60} 分钟截断。`.trim()
      }
    })

    // 中风险筛查：前 2 周只出轻松跑 + 长距离，质量课从第 3 周起解锁
    if (screening.riskLevel === 'moderate' && weekPlan.week <= 2) {
      sessions.forEach((s) => {
        if (s.type === 'tempo' || s.type === 'interval' || s.type === 'race') {
          s.level = 'easy'
          s.type = 'easy'
          s.title = '轻松跑 · 有氧基础（保守版）'
          s.intensity = { ...INTENSITY.easy, ...{ level: 'easy', rpe: INTENSITY.easy.rpe } }
          const pace = paceRangeOf('easy', goalPace, profile.targetDistance)
          s.intensity.paceLow = pace.low
          s.intensity.paceHigh = pace.high
          s.adaptationNote = '你目前没有规律运动习惯，前 2 周只安排轻松跑与长距离，质量课从第 3 周起解锁。'
        }
      })
    }

    sessions.forEach((s) => applyInjuryAdaptation(s, profile))

    return { ...weekPlan, sessions }
  })

  // —— 强度分布 ——
  const zoneDistribution = computeZoneDistribution(weeks)

  // —— 步骤 7：伤病适配补充说明 ——
  const adaptationSummary = buildAdaptationSummary({
    profile,
    template,
    goalPace,
    startKm,
    weekVolumes,
    reachability,
    screening,
    zoneDistribution,
  })
  const totalKm = round(
    weeks.reduce((acc, w) => acc + w.sessions.reduce((a, s) => a + (s.distanceKm || 0), 0), 0),
    1,
  )

  return {
    id: `plan_${Date.now().toString(36)}`,
    templateId: template.id,
    templateName: template.name,
    targetDistance: profile.targetDistance,
    goalPace,
    goalTotalSec: goal.total,
    goalDerivedFrom: goal.derived,
    status: 'pending_confirm',
    currentWeek: 1,
    totalWeeks: weeks.length,
    startDate: new Date().toISOString().slice(0, 10),
    weeks,
    zoneDistribution,
    totalKm,
    templateRevision: template.id === 'T10-8W' ? PLAN_TEMPLATE_REVISION : 1,
    adaptationSummary,
    reachability,
    screening,
    sourceRefs: template.sourceRefs,
    createdAt: new Date().toISOString(),
  }
}

/** 强度分布（按公里数占比） */
export function computeZoneDistribution(weeks) {
  const totals = {}
  weeks.forEach((w) =>
    w.sessions.forEach((s) => {
      if (!s.distanceKm) return
      const key = s.level
      totals[key] = round((totals[key] || 0) + s.distanceKm, 1)
    }),
  )
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1
  return Object.entries(totals)
    .map(([level, km]) => ({
      level,
      km,
      ratio: km / sum,
      name: INTENSITY[level]?.name || level,
      color: INTENSITY[level]?.color,
    }))
    .sort((a, b) => b.km - a.km)
}

/**
 * 适配依据（PRD §B2 输出示例）。
 * 规则：数字全部来自引擎，此处只做组织；至少 3 条引用档案中的具体数值。
 */
export function buildAdaptationSummary({
  profile,
  template,
  goalPace,
  startKm,
  weekVolumes,
  reachability,
  screening,
  zoneDistribution = [],
}) {
  const items = []
  const peak = Math.max(...weekVolumes.map((w) => w.targetKm))
  const week1 = weekVolumes[0]
  const stepBackWeeks = weekVolumes.filter((w) => w.stepBack).map((w) => w.week)
  const taperWeeks = weekVolumes.filter((w) => w.taper).map((w) => w.week)
  const qualityWeeks = weekVolumes.filter((w) => w.quality === 'interval' || w.quality === 'race')

  items.push({
    icon: 'insights',
    title: '跑量起步',
    text: `你近3个月周跑量${profile.weeklyKm}公里，本计划第1周从${week1.targetKm}公里起步（${
      startKm >= profile.weeklyKm ? '+' : ''
    }${Math.round(((startKm - profile.weeklyKm) / profile.weeklyKm) * 100)}%），趋势线每周增幅控制在8%（≤10%上限）。`,
  })

  if (profile.best10kPace && goalPace) {
    const improvement = ((profile.best10kPace - goalPace) / profile.best10kPace) * 100
    items.push({
      icon: 'trending_down',
      title: '目标与当前水平',
      text: `你当前10公里配速${formatPace(profile.best10kPace)}，目标${formatPace(goalPace)}，需提升${improvement.toFixed(
        1,
      )}%，因此安排${template.durationWeeks}周周期。`,
    })
  }

  items.push({
    icon: 'calendar_today',
    title: '时间条件',
      text: `你有${profile.availableDays}次/周、每次${profile.availableMin}分钟的时间条件，质量课安排在周四、长距离安排在周六，力量课安排在周日。`,
  })

  if ((profile.injuries || []).filter((i) => i.active).length) {
    const parts = profile.injuries.filter((i) => i.active).map((i) => i.part).join('、')
    items.push({
      icon: 'health_and_safety',
      title: '伤病适配',
      text: `你自述${parts}不适，计划已降低相关强度（长距离 −20%、取消冲刺与下坡内容），并把每周力量课替换为针对性稳定训练。`,
    })
  } else {
    items.push({
      icon: 'verified_user',
      title: '无伤病记录',
      text: '你自述无伤病记录，因此未加入额外的关节稳定训练；但仍保留每周 1 次髋/核心力量课（循证：与 64% 更低的过度使用伤风险相关）。若后续出现不适，我会自动调整。',
    })
  }

  items.push({
    icon: 'monitoring',
    title: '回撤与减量',
      text: `第${stepBackWeeks.join('、')}周是回撤周（训练量下调约18%，强度不减），第${taperWeeks.join('、')}周是赛前减量周（总量指数下降约44%，强度与频次保持不变）——这三周不是偷懒，是让身体吸收前几周的训练。`,
  })

  const easyShare = zoneDistribution
    .filter((z) => ['easy', 'long', 'recovery'].includes(z.level))
    .reduce((acc, z) => acc + z.ratio, 0)
  items.push({
    icon: 'speed',
    title: '强度分布',
    text: `本周期低强度（轻松跑+长距离）占总跑量约${Math.round(easyShare * 100)}%，质量课集中在第${qualityWeeks
      .map((w) => w.week)
      .join('、')}周——符合80/20两极化分布原则，不要把轻松跑跑成“中等强度”。`,
  })

  if (screening.riskLevel === 'moderate') {
    items.push({
      icon: 'info',
      title: '保守起步',
      text: '你目前没有规律运动习惯，前 2 周只出轻松跑与长距离，质量课从第 3 周起解锁。',
    })
  }

  reachability.notices.forEach((n) => items.push({ icon: 'warning', title: '可达性校验', text: n }))

  return items
}

