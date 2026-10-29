import { generateWithProvider } from './provider.js'
import { buildPlanPrompts } from './prompts.js'
import { validateGeneratedPlan } from './outputValidator.js'
import { buildSessionContent, materializePlanExercises, getActionCatalog } from '../../domain/exercises.js'
import { config } from '../../config.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function normalizeAiTypes(plan) {
  return {
    ...plan,
    weeks: (plan.weeks || []).map((week) => ({
      ...week,
      sessions: (week.sessions || []).map((session) => {
        const type = session.type === 'aerobic' ? 'easy' : session.type
        return { ...session, type, mainRun: session.mainRun ? { ...session.mainRun, type } : session.mainRun }
      }),
    })),
  }
}

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
        intensity: {
          level: type === 'easy' || type === 'long' ? '轻松' : '受控',
          paceLow: goalPace,
          paceHigh: goalPace + (type === 'easy' || type === 'long' ? 20 : 10),
          rpe: type === 'interval' ? [6, 8] : type === 'tempo' || type === 'race' ? [5, 7] : [2, 4],
          hrZone: '—',
          effort: type === 'easy' || type === 'long' ? '轻松' : '受控',
        },
        description: blueprint.focus,
        structure: {
          pattern: blueprint.qualityPlan?.pattern || '连续轻松跑 → 放松',
          mainRun: { type, distanceKm, durationMin },
        },
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
  if (config.ai.provider !== 'mock') {
    const system = `你是智程，负责为普通业余跑者生成 10 公里训练计划。
只返回 JSON，不要 Markdown 或解释。只能选择给定动作库中的 wu_ 热身动作和 cd_ 拉伸动作 ID。
遵守单次时长上限、长跑安全上限、训练类型和循序渐进原则；每个跑步课次必须有至少一个热身和一个拉伸动作。`
    const catalog = JSON.stringify(getActionCatalog())
    const profileText = JSON.stringify(profile)
    const skeleton = await generateWithProvider({
      system,
      user: `先生成完整 8 周训练骨架，不要生成具体动作。跑者档案：${profileText}\n模板：${JSON.stringify(template)}\n返回 {"weeks":[{"week":1,"phase":"阶段","focus":"本周重点","totalKm":0,"stepBack":false,"taper":false,"quality":"aerobic","sessions":[{"id":"w1s1","type":"easy","distanceKm":0,"durationMin":0}]}]}。必须包含 8 周，体现逐步增加、回撤周和最后一周减量；周与周之间要有连续性。`,
      maxTokens: 1800,
    })
    if (!Array.isArray(skeleton?.weeks) || skeleton.weeks.length !== 8) {
      const error = new Error('AI 未返回完整训练周期骨架')
      error.code = 'AI_OUTPUT_INVALID'
      error.details = ['训练周期骨架必须包含 8 周']
      throw error
    }
    const buildWeekUser = (blueprint, index, repairErrors = []) => {
      const current = skeleton.weeks[index]
      const previous = skeleton.weeks[index - 1] || null
      const next = skeleton.weeks[index + 1] || null
      return `生成第 ${index + 1} 周具体安排。\n跑者档案：${profileText}\n完整周期骨架：${JSON.stringify(skeleton.weeks)}\n上一周骨架（用于衔接）：${JSON.stringify(previous)}\n本周骨架：${JSON.stringify(current)}\n下一周骨架（用于为下一周留余量）：${JSON.stringify(next)}\n本周模板：${JSON.stringify(blueprint)}\n动作库（只能使用这些 id）：${catalog}\n必须遵守骨架的周跑量、阶段、回撤/减量标记和前后周衔接，返回一个包含 week、phase、focus、totalKm、sessions 的 JSON；每个 session 至少包含 id、week、dayOffset、dayLabel、type、title、distanceKm、durationMin、description、structure、preRunWarmup、mainRun、postRunStretch、adaptationNote。\n训练类型只能是 easy、recovery、long、tempo、interval、race、strength；easy/recovery 只选 wu_walk、wu_ankle 和 applies=all 的 cd 动作。练前和练后字段必须严格输出对象，例如：preRunWarmup:{title:'练前动态激活',duration:5,exercises:['wu_walk','wu_ankle']}，postRunStretch:{title:'练后静态拉伸',duration:5,exercises:['cd_calf','cd_quad']}；exercises 只能填动作库中的完整 id，不能留空，不能填名称。动作库的 applies 不包含当前训练类型时禁止选择该动作。mainRun 的 type、distanceKm、durationMin 必须与课次一致；数字必须是数字类型。${repairErrors.length ? `\n上一版被后端安全校验拦截，请只修正这些问题：${repairErrors.join('；')}` : ''}`
    }
    const weeks = await Promise.all(template.blueprint.map(async (blueprint, index) => {
      const user = buildWeekUser(blueprint, index)
      return generateWithProvider({ system, user, maxTokens: 1800 })
    }))
    const plan = {
      templateId: template.id,
      templateName: template.name,
      targetDistance: '10K',
      goalPace: formatPace(paceSeconds(profile)),
      goalTotalSec: Number(profile.targetTime) || 0,
      status: 'ready',
      currentWeek: 1,
      totalWeeks: 8,
      startDate: new Date().toISOString().slice(0, 10),
      weeks,
      totalKm: Number(weeks.reduce((sum, week) => sum + Number(week.totalKm || 0), 0).toFixed(1)),
      adaptationSummary: '根据跑者档案、目标配速、训练基础和可训练时间生成。',
      screening: { riskLevel: profile.riskLevel || 'low', cleared: profile.riskLevel !== 'medical_confirm' },
      zoneDistribution: { easy: 70, quality: 20, recovery: 10 },
      sourceRefs: template.sourceRefs || [],
      createdAt: new Date().toISOString(),
    }
    let normalized = materializePlanExercises(normalizeMainRun(normalizeAiTypes(plan)))
    let validation = validateGeneratedPlan(normalized, profile, template)
    if (!validation.valid) {
      const weekErrors = new Map()
      validation.errors.forEach((message) => {
        const match = message.match(/^第(\d+)周/)
        if (!match) return
        const weekIndex = Number(match[1]) - 1
        const list = weekErrors.get(weekIndex) || []
        list.push(message)
        weekErrors.set(weekIndex, list)
      })
      await Promise.all([...weekErrors.entries()].map(async ([weekIndex, errors]) => {
        const repaired = await generateWithProvider({
          system,
          user: buildWeekUser(template.blueprint[weekIndex], weekIndex, errors),
          maxTokens: 1800,
        })
        if (repaired) weeks[weekIndex] = repaired
      }))
      plan.weeks = weeks
      normalized = materializePlanExercises(normalizeMainRun(normalizeAiTypes(plan)))
      validation = validateGeneratedPlan(normalized, profile, template)
    }
    if (!validation.valid) {
      const error = new Error('AI 生成的训练计划未通过安全校验')
      error.code = 'AI_OUTPUT_INVALID'
      error.details = validation.errors
      throw error
    }
    return normalized
  }
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
