/**
 * 目标可达性校验 —— 当前版本的计划生成安全校验。
 *
 * 五项校验：提升幅度 / 精英级目标 / 强度跳跃 / 周跑量倒挂 / 伤病冲突。
 * 任一触发都会产出「修正版计划」并附带原因说明。
 */
import { eliteFor } from '../constants/grades.js'
import { formatClock } from '../utils/pace.js'

const WARNING = 'warn'
const BLOCK = 'block'

/**
 * @param {object} profile 跑者档案（已计算 pace 字段）
 * @param {object} planDraft 计划草稿 { template, weeks }
 * @returns {{checks:Array, hasBlock:boolean, hasWarn:boolean, notices:string[]}}
 */
export function runReachabilityChecks(profile, planDraft) {
  const checks = []
  const notices = []

  const goalPace = profile.targetPace
  const currentPace = profile.best10kPace || profile.easyPace
  const targetDistance = profile.targetDistance

  // —— 1. 提升幅度：目标成绩比当前最好成绩快 > 10% ——
  if (currentPace && goalPace) {
    const improvement = (currentPace - goalPace) / currentPace
    if (improvement > 0.1) {
      checks.push({
        key: 'improvement',
        level: WARNING,
        title: '目标跨度偏大',
        detail: `目标配速 ${formatClock(goalPace)} 比当前 ${formatClock(currentPace)} 快 ${(improvement * 100).toFixed(1)}%，超过 10% 的安全跨度。`,
        advice: '建议延长一个周期（+4 周）；若坚持按目标生成，计划中会标注「高目标，风险自担」。',
      })
      notices.push(
        `你的目标相当于要在 ${planDraft.template.durationWeeks} 周内把配速从 ${formatClock(currentPace)} 提升到 ${formatClock(goalPace)}（+${(improvement * 100).toFixed(1)}%），跨度偏大，生成的计划已按保守路径铺排。`,
      )
    }
  }

  // —— 2. 精英级目标：优于同年龄组田协精英级标准 ——
  const eliteSec = eliteFor(targetDistance, profile.gender, profile.age)
  if (eliteSec && goalPace) {
    const targetTotal = goalPace * (targetDistance === '5K' ? 5 : targetDistance === '10K' ? 10 : targetDistance === 'HM' ? 21.0975 : 42.195)
    if (targetTotal <= eliteSec) {
      checks.push({
        key: 'elite',
        level: WARNING,
        title: '该成绩属精英级水平',
        detail: `目标成绩 ${formatClock(targetTotal)} 已达到或优于 ${profile.age} 岁组田协精英级标准（${formatClock(eliteSec)}）。`,
        advice: '通常需要专项训练与长期积累；建议改为等级目标或完赛目标。',
      })
      notices.push(
        `你设定的目标成绩已达到田协同年龄组精英级区间，这通常需要专项训练与长期积累，本计划以「安全完赛 + 逐步逼近」为策略铺排。`,
      )
    }
  }

  // —— 3. 强度跳跃：目标配速 < 当前舒适配速 30 秒/km ——
  if (profile.easyPace && goalPace && profile.easyPace - goalPace > 30) {
    checks.push({
      key: 'intensity_gap',
      level: WARNING,
      title: '目标强度高于当前舒适强度',
      detail: `目标配速 ${formatClock(goalPace)} 比你的舒适配速 ${formatClock(profile.easyPace)} 快 ${Math.round(profile.easyPace - goalPace)} 秒/公里。`,
      advice: '建议先做 8 周基础期，把舒适配速抬上来后再冲成绩。',
    })
    notices.push(
      `你的目标配速比当前舒适配速快了 ${Math.round(profile.easyPace - goalPace)} 秒/公里，本计划前 2 周以抬升有氧基础为主，避免直接上强度。`,
    )
  }

  // —— 4. 周跑量倒挂：目标周期所需跑量 > 当前周跑量 × 1.5 ——
  const neededWeekly = planDraft.weeks?.[planDraft.weeks.length - 1]?.targetKm || 0
  if (profile.weeklyKm && neededWeekly > profile.weeklyKm * 1.5) {
    checks.push({
      key: 'volume_inversion',
      level: WARNING,
      title: '目标周期所需跑量高于当前水平 50%',
      detail: `计划末周目标 ${neededWeekly}km/周，当前周跑量 ${profile.weeklyKm}km/周。`,
      advice: '周期自动延长，或提示该目标不可达。',
    })
    notices.push(
      `计划末周目标跑量 ${neededWeekly}km 明显高于你当前的 ${profile.weeklyKm}km，已通过延长周期与插入回撤周来摊平增幅。`,
    )
  }

  // —— 5. 伤病冲突：目标周期 > 12 周 且存在未痊愈伤病 ——
  const activeInjury = (profile.injuries || []).some((i) => i.active)
  if (planDraft.template.durationWeeks > 12 && activeInjury) {
    checks.push({
      key: 'injury_conflict',
      level: WARNING,
      title: '长周期 + 未痊愈伤病',
      detail: `目标周期 ${planDraft.template.durationWeeks} 周，且存在未痊愈伤病。`,
      advice: '提示就医确认（ACSM 预参与筛查要求），并自动改为保守版。',
    })
    notices.push(
      `检测到你存在未痊愈伤病，本计划已自动切换为保守版：取消坡度与冲刺内容，并强制保留每周 1 次髋/核心稳定训练。`,
    )
  }

  return {
    checks,
    hasBlock: checks.some((c) => c.level === BLOCK),
    hasWarn: checks.length > 0,
    notices,
  }
}
