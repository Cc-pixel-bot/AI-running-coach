/**
 * 10 公里专业训练模板库（Demo）。
 *
 * 三类名称是产品内部分类，不是官方分类。周跑量、频率和分层数值均为
 * 当前 Demo 的训练模板配置，供后端 AI 生成计划时参考。
 * 模板描述周期结构；每日距离、时长、配速和动作由 AI 结合跑者档案生成。
 */

export const QUALITY_SESSION_META = {
  tempo: { title: '节奏跑', icon: 'speed', structure: '热身 → 受控节奏段 → 放松', purpose: '提高持续跑能力，保持可控强度。' },
  interval: { title: '间歇跑', icon: 'bolt', structure: '热身 → 分段快跑与慢跑恢复 → 放松', purpose: '提升速度储备，优先保持各组节奏稳定。' },
  race: { title: '专项节奏跑', icon: 'flag', structure: '热身 → 目标配速段 → 放松', purpose: '建立 10 公里专项节奏感，避免前快后慢。' },
  aerobic: { title: '有氧跑', icon: 'directions_run', structure: '全程轻松匀速有氧 → 放松', purpose: '巩固有氧基础，帮助身体吸收训练负荷。' },
}

export function buildBlueprint(phases) {
  const blueprint = []
  phases.forEach((phase) => {
    for (let i = 0; i < phase.weeks; i += 1) {
      blueprint.push({
        week: blueprint.length + 1,
        phase: phase.phase,
        phaseName: phase.phaseName,
        quality: phase.quality,
        stepBack: Boolean(phase.stepBack),
        taper: Boolean(phase.taper),
        focus: phase.focus,
        qualityPlan: phase.qualityPlan,
      })
    }
  })
  return blueprint
}

const SOURCE_REFS = [
  { file: '全民健身指南（国家体育总局）', usedFor: '循序渐进、个性化、初期与提高阶段、热身与放松', version: '2017' },
  { file: '运动处方中国专家共识（2023）', usedFor: 'FITT-VP、适应/提高阶段、恢复、动态评估与安全停止条件', version: '2023' },
  { file: '运动处方行业标准（国家体育总局）', usedFor: '频率、强度、类型、时间、风险和注意事项的结构要求', version: '现行公开标准' },
]

const BASE_POLICY = { weeklyGain: 0.06, qualityChangeGain: 0.03, stepBackDrop: 0.18, taperFactors: [0.55], minWeeklyKm: 8 }

const ADAPT = [
  { weeks: 2, phase: 'base', phaseName: '适应期', quality: 'aerobic', focus: '建立规律训练，优先轻松跑与恢复能力', qualityPlan: { title: '轻松有氧', pattern: '轻松匀速跑，始终保留余力', description: '先建立训练习惯，不安排高强度刺激。' } },
  { weeks: 1, phase: 'base', phaseName: '适应期', quality: 'tempo', focus: '延长可持续跑时间，保持动作放松', qualityPlan: { title: '短节奏入门', pattern: '热身 → 短节奏段 → 放松', description: '从第三周开始尝试短时受控节奏，不追求速度。' } },
  { weeks: 1, phase: 'base', phaseName: '回撤周', quality: 'aerobic', stepBack: true, focus: '降低训练量，让身体吸收前三周负荷', qualityPlan: { title: '恢复有氧', pattern: '缩短总量，保持轻松强度', description: '回撤周不加速，重点是恢复和连续性。' } },
  { weeks: 1, phase: 'build', phaseName: '基础提升', quality: 'tempo', focus: '引入短时受控节奏，提升持续跑能力', qualityPlan: { title: '短节奏跑', pattern: '热身 → 短节奏段 → 慢跑恢复 → 放松', description: '节奏段保持可控，结束后应能较快恢复。' } },
  { weeks: 1, phase: 'build', phaseName: '回撤周', quality: 'aerobic', stepBack: true, focus: '第二次回撤，巩固训练习惯', qualityPlan: { title: '轻松有氧', pattern: '轻松匀速跑，不做加速', description: '降低总量，保留规律训练感觉。' } },
  { weeks: 1, phase: 'specific', phaseName: '专项准备', quality: 'race', focus: '用短目标配速段熟悉 10 公里节奏', qualityPlan: { title: '短目标配速', pattern: '热身 → 短目标配速段 → 放松', description: '只做短时间专项体验，保持节奏均匀。' } },
  { weeks: 1, phase: 'taper', phaseName: '周期末减量', quality: 'race', taper: true, focus: '降低总量，保持轻快和信心', qualityPlan: { title: '轻量专项唤醒', pattern: '热身 → 少量目标配速段 → 放松', description: '周期末减量，不补课、不追加强度。' } },
]

const BASE = [
  { weeks: 2, phase: 'base', phaseName: '适应期', quality: 'aerobic', focus: '稳定训练节奏，建立有氧基线', qualityPlan: { title: '稳定有氧', pattern: '轻松匀速跑，保持呼吸从容', description: '先稳定频率，再逐步增加训练量。' } },
  { weeks: 1, phase: 'build', phaseName: '基础提升', quality: 'tempo', focus: '加入受控节奏，提升持续跑能力', qualityPlan: { title: '连续节奏', pattern: '热身 → 连续受控节奏 → 放松', description: '保持可重复的节奏，不做冲刺。' } },
  { weeks: 1, phase: 'base', phaseName: '回撤周', quality: 'aerobic', stepBack: true, focus: '降低训练量，恢复后再继续递进', qualityPlan: { title: '恢复有氧', pattern: '轻松匀速跑，减少总量', description: '回撤周不叠加新强度。' } },
  { weeks: 1, phase: 'specific', phaseName: '专项提升', quality: 'tempo', focus: '延长节奏段，建立 10 公里专项耐力', qualityPlan: { title: '分段节奏', pattern: '热身 → 分段节奏跑 → 慢跑恢复 → 放松', description: '分段完成，优先保持动作和节奏稳定。' } },
  { weeks: 1, phase: 'build', phaseName: '回撤周', quality: 'tempo', stepBack: true, focus: '第二次回撤，保持节奏感并降低总量', qualityPlan: { title: '短节奏维持', pattern: '热身 → 短节奏段 → 放松', description: '减少总量，保留适量质量刺激。' } },
  { weeks: 1, phase: 'specific', phaseName: '专项提升', quality: 'race', focus: '完成较长目标配速段，检验专项准备', qualityPlan: { title: '目标配速跑', pattern: '热身 → 目标配速段 → 放松', description: '均匀控制目标配速，不提前冲刺。' } },
  { weeks: 1, phase: 'taper', phaseName: '周期末减量', quality: 'race', taper: true, focus: '减少总量，保留节奏和新鲜感', qualityPlan: { title: '减量专项', pattern: '热身 → 少量目标配速段 → 放松', description: '减量优先，保证恢复。' } },
]

const ADVANCED = [
  { weeks: 1, phase: 'base', phaseName: '适应期', quality: 'aerobic', focus: '确认训练基线，准备进入专项负荷', qualityPlan: { title: '有氧基线', pattern: '轻松匀速跑，保持动作经济', description: '用可控训练开始周期，不急于提高强度。' } },
  { weeks: 2, phase: 'specific', phaseName: '专项提升', quality: 'tempo', focus: '提高阈值附近的持续能力', qualityPlan: { title: '持续节奏', pattern: '热身 → 稳定节奏段 → 放松', description: '控制在可持续强度，重点是均匀完成。' } },
  { weeks: 1, phase: 'base', phaseName: '回撤周', quality: 'aerobic', stepBack: true, focus: '降低负荷，准备下一轮专项刺激', qualityPlan: { title: '恢复有氧', pattern: '轻松匀速跑，减少总量', description: '回撤周不提高强度。' } },
  { weeks: 1, phase: 'specific', phaseName: '专项提升', quality: 'interval', focus: '提升速度储备与速度耐力', qualityPlan: { title: '分段间歇', pattern: '热身 → 多组快跑与慢跑恢复 → 放松', description: '每组保持可重复，宁可保守也不前快后慢。' } },
  { weeks: 1, phase: 'specific', phaseName: '回撤周', quality: 'tempo', stepBack: true, focus: '降低总量，保留受控节奏', qualityPlan: { title: '短节奏维持', pattern: '热身 → 短节奏段 → 放松', description: '为最后专项周保留恢复空间。' } },
  { weeks: 1, phase: 'specific', phaseName: '专项提升', quality: 'race', focus: '完成目标配速专项练习', qualityPlan: { title: '10 公里专项节奏', pattern: '热身 → 分段目标配速 → 放松', description: '检验节奏控制和专项耐力，不做全力测试。' } },
  { weeks: 1, phase: 'taper', phaseName: '周期末减量', quality: 'race', taper: true, focus: '降低总量，保持速度感觉', qualityPlan: { title: '目标配速唤醒', pattern: '热身 → 少量目标配速段 → 放松', description: '减少训练量，避免追加强度影响状态。' } },
]

function createTemplate({ id, name, runsPerWeek, sessionsPerWeek, goalTypes, volumePolicy, blueprint }) {
  return { id, name, targetDistance: '10K', durationWeeks: 8, runsPerWeek, sessionsPerWeek, goalTypes, volumePolicy, sourceRefs: SOURCE_REFS.map((source) => ({ ...source })), blueprint: buildBlueprint(blueprint) }
}

export const TEMPLATES = {
  'T10-ADAPT-2': createTemplate({ id: 'T10-ADAPT-2', name: '10 公里适应型 · 低频起步', runsPerWeek: 2, sessionsPerWeek: 2, goalTypes: ['improve_10k', 'experience'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.05, qualityChangeGain: 0.02, minWeeklyKm: 8 }, blueprint: ADAPT }),
  'T10-ADAPT-3': createTemplate({ id: 'T10-ADAPT-3', name: '10 公里适应型 · 常规起步', runsPerWeek: 3, sessionsPerWeek: 3, goalTypes: ['improve_10k', 'experience'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.055, qualityChangeGain: 0.025, minWeeklyKm: 10 }, blueprint: ADAPT }),
  'T10-ADAPT-4': createTemplate({ id: 'T10-ADAPT-4', name: '10 公里适应型 · 规律重建', runsPerWeek: 3, sessionsPerWeek: 4, goalTypes: ['improve_10k', 'experience'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.06, qualityChangeGain: 0.025, minWeeklyKm: 12 }, blueprint: ADAPT }),
  'T10-BASE-3': createTemplate({ id: 'T10-BASE-3', name: '10 公里基础提升型 · 稳步进阶', runsPerWeek: 3, sessionsPerWeek: 4, goalTypes: ['improve_10k'], volumePolicy: { ...BASE_POLICY, minWeeklyKm: 12 }, blueprint: BASE }),
  'T10-BASE-4': createTemplate({ id: 'T10-BASE-4', name: '10 公里基础提升型 · 稳定进阶', runsPerWeek: 4, sessionsPerWeek: 5, goalTypes: ['improve_10k'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.065, minWeeklyKm: 15 }, blueprint: BASE }),
  'T10-BASE-3-PLUS': createTemplate({ id: 'T10-BASE-3-PLUS', name: '10 公里基础提升型 · 节奏巩固', runsPerWeek: 3, sessionsPerWeek: 4, goalTypes: ['improve_10k'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.065, qualityChangeGain: 0.035, minWeeklyKm: 10 }, blueprint: BASE }),
  'T10-ADV-3': createTemplate({ id: 'T10-ADV-3', name: '10 公里进阶提升型 · 速度储备', runsPerWeek: 3, sessionsPerWeek: 4, goalTypes: ['improve_10k'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.065, minWeeklyKm: 16 }, blueprint: ADVANCED }),
  'T10-ADV-4': createTemplate({ id: 'T10-ADV-4', name: '10 公里进阶提升型 · 专项突破', runsPerWeek: 4, sessionsPerWeek: 5, goalTypes: ['improve_10k'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.07, qualityChangeGain: 0.035, minWeeklyKm: 18 }, blueprint: ADVANCED }),
  'T10-ADV-3-PLUS': createTemplate({ id: 'T10-ADV-3-PLUS', name: '10 公里进阶提升型 · 配速巩固', runsPerWeek: 3, sessionsPerWeek: 4, goalTypes: ['improve_10k'], volumePolicy: { ...BASE_POLICY, weeklyGain: 0.07, qualityChangeGain: 0.035, minWeeklyKm: 18 }, blueprint: ADVANCED }),
}

export const TEMPLATES_BY_GOAL = { improve_10k: Object.keys(TEMPLATES) }

export const TARGET_TYPES = {
  improve_10k: { key: 'improve_10k', label: '提升 10km', distance: '10K', weeks: 8, icon: 'sprint' },
}
