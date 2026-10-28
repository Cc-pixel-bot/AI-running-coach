/**
 * 后端唯一可信的 10K Demo 模板库。
 * 周跑量、频率和分层数值均为“产品 Demo 规则”，不是国家标准。
 */

export const QUALITY_SESSION_META = {
  tempo: { title: '节奏跑', pattern: '热身 → 受控节奏段 → 放松' },
  interval: { title: '间歇跑', pattern: '热身 → 分段快跑与慢跑恢复 → 放松' },
  race: { title: '比赛配速跑', pattern: '热身 → 目标配速段 → 放松' },
  aerobic: { title: '有氧跑', pattern: '全程轻松匀速有氧 → 放松' },
}

const SOURCE_REFS = [
  { file: '全民健身指南（国家体育总局）', usedFor: '循序渐进、个性化、阶段安排、热身与放松', version: '官方公开资料' },
  { file: '运动处方中国专家共识（2023）', usedFor: 'FITT-VP、适应/提高阶段、恢复与安全停止条件', version: '2023' },
  { file: '运动处方行业标准（国家体育总局）', usedFor: '频率、强度、类型、时间、风险和注意事项', version: '现行公开标准' },
]

const policy = (overrides = {}) => ({
  weeklyGain: 0.06,
  qualityChangeGain: 0.03,
  stepBackDrop: 0.18,
  taperFactors: [0.55],
  minWeeklyKm: 8,
  ...overrides,
})

const quality = (title, pattern, description) => ({ title, pattern, description })

const ADAPT = [
  ['base', '适应期', 'aerobic', false, false, '建立规律训练，优先轻松跑与恢复能力', quality('轻松有氧', '轻松匀速跑，始终保留余力', '先建立训练习惯，不安排高强度刺激。')],
  ['base', '适应期', 'tempo', false, false, '从第三周尝试短时受控节奏', quality('短节奏入门', '热身 → 短节奏段 → 放松', '不追求速度，重点是动作稳定。')],
  ['base', '回撤周', 'aerobic', true, false, '降低训练量，让身体吸收前期负荷', quality('恢复有氧', '轻松匀速跑，减少总量', '回撤周不提高强度。')],
  ['build', '基础提升', 'tempo', false, false, '引入短时受控节奏', quality('短节奏跑', '热身 → 短节奏段 → 慢跑恢复 → 放松', '节奏段保持可控。')],
  ['build', '回撤周', 'aerobic', true, false, '巩固训练习惯', quality('轻松有氧', '轻松匀速跑，不做加速', '降低总量，保留连续性。')],
  ['specific', '专项准备', 'race', false, false, '熟悉 10 公里专项节奏', quality('短目标配速', '热身 → 短目标配速段 → 放松', '保持节奏均匀。')],
  ['taper', '赛前减量', 'race', false, true, '降低总量，保持轻快和信心', quality('轻量专项唤醒', '热身 → 少量目标配速段 → 放松', '不补课、不追加强度。')],
]

const BASE = [
  ['base', '适应期', 'aerobic', false, false, '稳定训练节奏，建立有氧基线', quality('稳定有氧', '轻松匀速跑，保持呼吸从容', '先稳定频率，再逐步增加训练量。')],
  ['build', '基础提升', 'tempo', false, false, '加入受控节奏', quality('连续节奏', '热身 → 连续受控节奏 → 放松', '保持可重复的节奏。')],
  ['base', '回撤周', 'aerobic', true, false, '降低训练量，恢复后继续递进', quality('恢复有氧', '轻松匀速跑，减少总量', '不叠加新强度。')],
  ['specific', '专项提升', 'tempo', false, false, '建立 10 公里专项耐力', quality('分段节奏', '热身 → 分段节奏跑 → 慢跑恢复 → 放松', '优先保持动作和节奏稳定。')],
  ['build', '回撤周', 'tempo', true, false, '保持节奏感并降低总量', quality('短节奏维持', '热身 → 短节奏段 → 放松', '保留适量质量刺激。')],
  ['specific', '专项提升', 'race', false, false, '检验专项准备', quality('目标配速跑', '热身 → 目标配速段 → 放松', '均匀控制目标配速。')],
  ['taper', '赛前减量', 'race', false, true, '减少总量，保留新鲜感', quality('减量专项', '热身 → 少量目标配速段 → 放松', '减量优先，保证恢复。')],
]

const ADVANCED = [
  ['base', '适应期', 'aerobic', false, false, '确认训练基线', quality('有氧基线', '轻松匀速跑，保持动作经济', '不急于提高强度。')],
  ['specific', '专项提升', 'tempo', false, false, '提高持续能力', quality('持续节奏', '热身 → 稳定节奏段 → 放松', '控制在可持续强度。')],
  ['base', '回撤周', 'aerobic', true, false, '降低负荷，准备专项刺激', quality('恢复有氧', '轻松匀速跑，减少总量', '回撤周不提高强度。')],
  ['specific', '专项提升', 'interval', false, false, '提升速度储备与速度耐力', quality('分段间歇', '热身 → 多组快跑与慢跑恢复 → 放松', '每组保持可重复。')],
  ['specific', '回撤周', 'tempo', true, false, '降低总量，保留受控节奏', quality('短节奏维持', '热身 → 短节奏段 → 放松', '为最后专项周保留恢复空间。')],
  ['specific', '专项提升', 'race', false, false, '完成目标配速专项练习', quality('10 公里专项节奏', '热身 → 分段目标配速 → 放松', '不做全力测试。')],
  ['taper', '赛前减量', 'race', false, true, '降低总量，保持速度感觉', quality('赛前唤醒', '热身 → 少量目标配速段 → 放松', '避免追加强度影响状态。')],
]

function expand(phases) {
  const rows = [...phases]
  // 每套 Demo 蓝图固定 8 周；第 6 周专项课重复一次，再进入第 8 周减量。
  if (rows.length === 7) rows.splice(rows.length - 1, 0, rows[rows.length - 2])
  const blueprint = []
  rows.forEach((phase) => {
    blueprint.push({
      week: blueprint.length + 1,
      phase: phase[0],
      phaseName: phase[1],
      quality: phase[2],
      stepBack: phase[3],
      taper: phase[4],
      focus: phase[5],
      qualityPlan: phase[6],
    })
  })
  return blueprint
}

function createTemplate({ id, name, runsPerWeek, sessionsPerWeek, volumePolicy, blueprint, goalTypes = ['improve_10k'] }) {
  return { id, name, targetDistance: '10K', durationWeeks: 8, runsPerWeek, sessionsPerWeek, goalTypes, volumePolicy, sourceRefs: SOURCE_REFS, blueprint: expand(blueprint) }
}

export const TEMPLATES = {
  'T10-ADAPT-2': createTemplate({ id: 'T10-ADAPT-2', name: '10 公里适应型 · 低频起步', runsPerWeek: 2, sessionsPerWeek: 2, goalTypes: ['improve_10k', 'experience'], volumePolicy: policy({ weeklyGain: 0.05, qualityChangeGain: 0.02 }) , blueprint: ADAPT }),
  'T10-ADAPT-3': createTemplate({ id: 'T10-ADAPT-3', name: '10 公里适应型 · 常规起步', runsPerWeek: 3, sessionsPerWeek: 3, goalTypes: ['improve_10k', 'experience'], volumePolicy: policy({ weeklyGain: 0.055, qualityChangeGain: 0.025, minWeeklyKm: 10 }), blueprint: ADAPT }),
  'T10-ADAPT-4': createTemplate({ id: 'T10-ADAPT-4', name: '10 公里适应型 · 规律重建', runsPerWeek: 3, sessionsPerWeek: 4, goalTypes: ['improve_10k', 'experience'], volumePolicy: policy({ minWeeklyKm: 12 }), blueprint: ADAPT }),
  'T10-BASE-3': createTemplate({ id: 'T10-BASE-3', name: '10 公里基础提升型 · 稳步进阶', runsPerWeek: 3, sessionsPerWeek: 4, volumePolicy: policy({ minWeeklyKm: 12 }), blueprint: BASE }),
  'T10-BASE-4': createTemplate({ id: 'T10-BASE-4', name: '10 公里基础提升型 · 稳定进阶', runsPerWeek: 4, sessionsPerWeek: 5, volumePolicy: policy({ weeklyGain: 0.065, minWeeklyKm: 15 }), blueprint: BASE }),
  'T10-BASE-3-PLUS': createTemplate({ id: 'T10-BASE-3-PLUS', name: '10 公里基础提升型 · 节奏巩固', runsPerWeek: 3, sessionsPerWeek: 4, volumePolicy: policy({ weeklyGain: 0.065, qualityChangeGain: 0.035, minWeeklyKm: 10 }), blueprint: BASE }),
  'T10-ADV-3': createTemplate({ id: 'T10-ADV-3', name: '10 公里进阶提升型 · 速度储备', runsPerWeek: 3, sessionsPerWeek: 4, volumePolicy: policy({ weeklyGain: 0.065, minWeeklyKm: 16 }), blueprint: ADVANCED }),
  'T10-ADV-4': createTemplate({ id: 'T10-ADV-4', name: '10 公里进阶提升型 · 专项突破', runsPerWeek: 4, sessionsPerWeek: 5, volumePolicy: policy({ weeklyGain: 0.07, qualityChangeGain: 0.035, minWeeklyKm: 18 }), blueprint: ADVANCED }),
  'T10-ADV-3-PLUS': createTemplate({ id: 'T10-ADV-3-PLUS', name: '10 公里进阶提升型 · 配速巩固', runsPerWeek: 3, sessionsPerWeek: 4, volumePolicy: policy({ weeklyGain: 0.07, qualityChangeGain: 0.035, minWeeklyKm: 18 }), blueprint: ADVANCED }),
}

export const TEMPLATES_BY_GOAL = { improve_10k: Object.keys(TEMPLATES) }

export const TARGET_TYPES = { improve_10k: { key: 'improve_10k', label: '提升 10km', distance: '10K', weeks: 8, icon: 'sprint' } }
