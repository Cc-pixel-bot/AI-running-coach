import { generateWithProvider } from './provider.js'
import { buildPlanPrompts } from './prompts.js'
import { validateGeneratedPlan } from './outputValidator.js'
import { buildSessionContent, materializePlanExercises } from '../../domain/exercises.js'
import { config } from '../../config.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function paceSeconds(profile) {
  const value = Number(profile.targetPace || profile.easyPace || 420)
  return Number.isFinite(value) && value > 0 ? value : 420
}

function formatPace(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = String(Math.round(seconds % 60)).padStart(2, '0')
  return `${minutes}分${remainder}秒/公里`
}

function buildMockPlan(profile, template) {
  const maxMin = Number(profile.availableMin) || 60
  const longest = Number(profile.longestRunKm) || 6
  const weeklyBase = Math.max(Number(profile.weeklyKm) || 12, Number(template.volumePolicy.minWeeklyKm) || 8)
  const sessionsPerWeek = Number(profile.availableDays || template.sessionsPerWeek || 3)
  const goalPace = paceSeconds(profile)
  const weeks = template.blueprint.map((blueprint, index) => {
    const factor = blueprint.taper ? 0.72 : blueprint.stepBack ? 0.82 : 1 + Math.min(index, 4) * 0.05
    const totalKm = Number((weeklyBase * factor).toFixed(1))
    const sessions = Array.from({ length: clamp(sessionsPerWeek, 2, 4) }, (_, day) => {
      const isLong = day === sessionsPerWeek - 1
      const isQuality = day === 1 && blueprint.quality !== 'aerobic'
      const type = isLong ? 'long' : (isQuality ? blueprint.quality : 'easy')
      const distanceKm = Number((isLong ? Math.min(longest * (blueprint.taper ? 0.8 : 1.05), totalKm * 0.45) : totalKm / sessionsPerWeek).toFixed(1))
      const durationMin = clamp(Math.round(distanceKm * (type === 'interval' ? 6.2 : 6.8)), 20, maxMin)
      const content = buildSessionContent({
        type,
        profile,
        distanceKm,
        durationMin,
        paceLow: goalPace,
        paceHigh: goalPace + (type === 'easy' || type === 'long' ? 20 : 10),
        structure: blueprint.qualityPlan?.pattern || '主体跑步训练',
      })
      return {
        id: `w${index + 1}s${day + 1}`,
        week: index + 1,
        dayOffset: day * 2,
        dayLabel: `第${day + 1}天`,
        status: index === 0 && day === 0 ? 'today' : 'upcoming',
        type,
        level: type === 'easy' || type === 'long' ? '基础' : '专项',
        title: type === 'long' ? '长距离慢跑' : (blueprint.qualityPlan?.title || '轻松跑'),
        distanceKm,
        durationMin,
        intensity: type === 'easy' || type === 'long' ? '轻松' : '受控',
        description: blueprint.focus,
        structure: blueprint.qualityPlan?.pattern || '连续轻松跑 → 放松',
        ...content,
        mainRun: { ...content.mainRun, type, distanceKm, durationMin },
        adaptationNote: `结合近期周跑量、最长连续跑和目标配速安排第${index + 1}周训练。`,
        coachQuote: '保持节奏，完成今天这一课。',
      }
    })
    return { week: index + 1, phase: blueprint.phaseName, focus: blueprint.focus, totalKm, sessions }
  })
  return {
    templateId: template.id,
    templateName: template.name,
    targetDistance: '10K',
    goalPace: formatPace(goalPace),
    goalTotalSec: Number(profile.targetTime) || 0,
    goalDerivedFrom: '根据目标完成时间换算，并结合近期成绩校准。',
    status: 'ready',
    currentWeek: 1,
    totalWeeks: 8,
    startDate: new Date().toISOString().slice(0, 10),
    weeks,
    zoneDistribution: { easy: 70, quality: 20, recovery: 10 },
    totalKm: Number(weeks.reduce((sum, week) => sum + week.totalKm, 0).toFixed(1)),
    adaptationSummary: '根据你的近期训练基础、目标用时、可训练天数和单次时长生成。',
    screening: { riskLevel: profile.riskLevel || 'low', cleared: profile.riskLevel !== 'medical_confirm' },
    sourceRefs: template.sourceRefs || [],
    createdAt: new Date().toISOString(),
  }
}

function normalizeMainRun(plan) {
  if (!plan || !Array.isArray(plan.weeks)) return plan
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      sessions: (week.sessions || []).map((session) => {
        if (session.type === 'strength' || !session.mainRun || typeof session.mainRun !== 'object') return session
        // 课次字段是保存和执行的唯一口径。保留 AI 生成的配速与结构，
        // 对齐重复的距离/时长字段，避免模型四舍五入造成无意义的校验失败。
        return {
          ...session,
          mainRun: {
            ...session.mainRun,
            type: session.type,
            distanceKm: Number(session.distanceKm),
            durationMin: Number(session.durationMin),
          },
        }
      }),
    })),
  }
}

export async function generatePlan({ profile, template }) {
  const prompts = buildPlanPrompts({ profile, template })
  const generate = (user) => generateWithProvider({
    system: prompts.system,
    user,
    fallback: () => buildMockPlan(profile, template),
  })

  let generatedPlan = await generate(prompts.user)
  let plan = materializePlanExercises(normalizeMainRun(generatedPlan))
  let validation = validateGeneratedPlan(plan, profile, template)

  // AI 输出偶尔会出现动作选择或数值字段的随机偏差。把校验结果反馈给
  // AI 重新生成一次，仍然必须通过同一套动作库和安全校验，不使用规则兜底。
  if (!validation.valid && config.ai.provider !== 'mock') {
    const repairUser = `${prompts.user}

上一版输出未通过后端安全校验，请重新完整生成 JSON。必须修正以下问题：
${validation.errors.map((item) => `- ${item}`).join('\n')}
不要解释原因，只返回修正后的完整 JSON。`
    generatedPlan = await generate(repairUser)
    plan = materializePlanExercises(normalizeMainRun(generatedPlan))
    validation = validateGeneratedPlan(plan, profile, template)
  }

  if (!validation.valid) {
    const error = new Error('AI 生成的训练计划未通过安全校验')
    error.code = 'AI_OUTPUT_INVALID'
    error.details = validation.errors
    throw error
  }
  return plan
}
