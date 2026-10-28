const SUPPORTED_TYPES = new Set(['easy', 'recovery', 'long', 'tempo', 'interval', 'race', 'strength'])
import { validateExerciseSection } from '../../domain/exercises.js'

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateGeneratedPlan(plan, profile, template) {
  const errors = []
  if (!plan || typeof plan !== 'object') errors.push('AI 返回内容不是计划对象')
  if (plan?.targetDistance !== '10K') errors.push('目标项目不是 10K')
  if (Number(plan?.totalWeeks) !== 8 || !Array.isArray(plan?.weeks) || plan.weeks.length !== 8) errors.push('计划周期不是完整 8 周')
  if (plan?.templateId !== template.id) errors.push('计划模板编号与匹配模板不一致')
  const maxMin = Number(profile.availableMin)
  const longest = Number(profile.longestRunKm)
  for (const week of plan?.weeks || []) {
    if (!Array.isArray(week.sessions) || week.sessions.length === 0) errors.push(`第${week.week}周缺少训练课次`)
    for (const session of week.sessions || []) {
      if (!SUPPORTED_TYPES.has(session.type)) errors.push(`第${week.week}周存在不支持的训练类型`)
      if (!isNumber(Number(session.distanceKm)) || Number(session.distanceKm) < 0) errors.push(`第${week.week}周距离数据无效`)
      if (!isNumber(Number(session.durationMin)) || Number(session.durationMin) <= 0) errors.push(`第${week.week}周时长数据无效`)
      if (maxMin > 0 && Number(session.durationMin) > maxMin) errors.push(`第${week.week}周存在超过单次时长上限的训练`)
      if (longest > 0 && session.type === 'long' && Number(session.distanceKm) > longest * 1.15) errors.push(`第${week.week}周长跑超过近期最长跑的安全范围`)
      if (session.type !== 'strength') {
        validateExerciseSection(session.preRunWarmup, 'warmup', errors, `第${week.week}周${session.id}练前动态激活`, profile, session.type)
        validateExerciseSection(session.postRunStretch, 'cooldown', errors, `第${week.week}周${session.id}练后静态拉伸`, profile, session.type)
        if (!session.mainRun || session.mainRun.type !== session.type) errors.push(`第${week.week}周${session.id}缺少主体训练结构`)
        if (session.mainRun && Number(session.mainRun.distanceKm) !== Number(session.distanceKm)) errors.push(`第${week.week}周${session.id}主体距离与课次距离不一致`)
        if (session.mainRun && Number(session.mainRun.durationMin) !== Number(session.durationMin)) errors.push(`第${week.week}周${session.id}主体时长与课次时长不一致`)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}
