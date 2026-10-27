/**
 * 训练模板库 —— PRD v1.2 §B1。
 *
 * 立场（PRD 原文）：模板库是官方结构的「统一格式重写」，不是复制。
 * 周期长度与阶段划分直接对齐官方计划，不自造、不压缩：
 *   - World Athletics 5km 官方计划 → 8 周 3 课
 *   - World Athletics 半马官方计划 → 12 周 3 课（Beginner/Intermediate/Advanced 三档）
 *   - B.A.A. 官方马拉松计划 → 20 周四阶段（3 周准备 + 6 周基础 + 9 周专项 + 2 周减量）
 *   - 爱尔兰田径协会 15 周计划 → 强度锚点（RPE + 说话测试）与回撤周机制
 *
 * 模板只声明「结构蓝图」（每周阶段、质量课类型、质量课递进、是否回撤/减量），
 * 具体跑量由 planEngine 依据跑者档案与训练量规则计算，避免手写 N×M 条课次。
 */

/** 回撤周 / 减量周的通用参数（PRD §5.1 R1 / R4） */
const VOLUME_POLICY = {
  weeklyGain: 0.08, // 趋势线每周增幅（≤10%，ACSM 渐进原则）
  qualityChangeGain: 0.04, // 同周强度与总量不同时推进（WA Advanced 原文）→ 增幅折半
  stepBackDrop: 0.18, // 回撤周 −18%（PRD 区间 −20~30%，取保守值）
  taperFactors: [0.56], // 减量期总量指数系数（对应 −44%，Bosquet 2007 的 41–60% 区间）
  minWeeklyKm: 8,
}

/** 质量课类型 → 课次标题模板 */
export const QUALITY_SESSION_META = {
  tempo: {
    title: '节奏跑',
    icon: 'speed',
    structure: '热身 15 分钟 → 持续节奏段 → 放松 10 分钟',
    purpose: '提高乳酸阈，把「舒服配速」的上限往后挪。',
  },
  interval: {
    title: '间歇跑',
    icon: 'bolt',
    structure: '热身 15 分钟 → 400m×8 组（组间慢跑 2 分钟）→ 放松 10 分钟',
    purpose: '刺激最大摄氧量，提升速度储备。',
  },
  race: {
    title: '比赛配速跑',
    icon: 'flag',
    structure: '热身 → 目标配速段 → 放松',
    purpose: '建立目标成绩的比赛节奏感（分段配速，避免前快后慢）。',
  },
  aerobic: {
    title: '有氧跑',
    icon: 'directions_run',
    structure: '全程匀速有氧，中途不做加速',
    purpose: '巩固有氧基础，恢复与代谢适应。',
  },
}

/**
 * 周蓝图生成器：把「阶段序列」翻译成逐周的质量课类型与特殊周标记。
 * @param {Array<{weeks:number, phase:string, phaseName:string, quality:string, qualityPlan?:object}>} phases
 */
function buildBlueprint(phases) {
  const blueprint = []
  phases.forEach((phase) => {
    for (let i = 0; i < phase.weeks; i += 1) {
      const week = blueprint.length + 1
      blueprint.push({
        week,
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

export const TEMPLATES = {
  'T5-WA': {
    id: 'T5-WA',
    name: '5km 提升 · 8 周计划',
    targetDistance: '5K',
    durationWeeks: 8,
    runsPerWeek: 3,
    sessionsPerWeek: 3,
    goalTypes: ['improve_5k', 'experience'],
    volumePolicy: { ...VOLUME_POLICY, weeklyGain: 0.07 },
    sourceRefs: [
      {
        file: '02b_World_Athletics_5K_Training_Programme.pdf',
        usedFor: '8 周 3 课结构、跑走比、渐进跑、间歇、strides、热身 5–10 分钟',
        version: 'WRRC Copenhagen 26 官方',
      },
    ],
    blueprint: buildBlueprint([
      { weeks: 3, phase: 'base', phaseName: '适应期', quality: 'tempo', focus: '建立跑走节奏与有氧基础，摸清当前水平' },
      { weeks: 1, phase: 'base', phaseName: '回撤周', quality: 'aerobic', stepBack: true, focus: '训练量回落，让身体吸收前三周负荷' },
      { weeks: 3, phase: 'build', phaseName: '专项提升', quality: 'interval', focus: '引入间歇与渐进跑，提升速度储备' },
      { weeks: 1, phase: 'peak', phaseName: '赛前减量', quality: 'race', taper: true, focus: '赛前减量 + 5km 测速' },
    ]),
  },

  'T10-8W': {
    id: 'T10-8W',
    name: '10km 提升 · 8 周计划',
    targetDistance: '10K',
    durationWeeks: 8,
    runsPerWeek: 3,
    sessionsPerWeek: 4, // 3 跑 + 1 力量
    goalTypes: ['improve_10k', 'experience'],
    volumePolicy: { ...VOLUME_POLICY },
    sourceRefs: [
      {
        file: '02c_World_Athletics_Half_Marathon_Training_Programme.pdf',
        usedFor: '阶段划分与强度配速表述方式（相对配速）',
        version: 'World Athletics 官方 12 周计划',
      },
      {
        file: '03_Athletics_Ireland_Intermediate_Runners.pdf',
        usedFor: 'RPE / 说话测试强度锚点、Step-back week 机制',
        version: '15-week plan, 2025',
      },
      {
        file: '02b_World_Athletics_5K_Training_Programme.pdf',
        usedFor: '从基础跑、变速/间歇到比赛配速与减量的渐进编排原则',
        version: 'WRRC Copenhagen 26 官方',
      },
      {
        file: '08_ACSM_FITT_VP / ACSM Guidelines 11th ed.',
        usedFor: '渐进原则、强度区间、每周 ≥1 次力量训练',
        version: '11th ed. 2021',
      },
    ],
    blueprint: buildBlueprint([
      {
        weeks: 1,
        phase: 'base',
        phaseName: '适应期',
        quality: 'tempo',
        focus: '建立基线，摸清当前水平与强度上限',
        qualityPlan: {
          title: '3 × 6 分钟受控节奏',
          pattern: '热身 → 3 × 6 分钟受控节奏（组间慢跑 2 分钟）→ 放松',
          description: '先建立节奏感，强度控制在能说短句的范围，不追求冲刺。',
        },
      },
      {
        weeks: 1,
        phase: 'base',
        phaseName: '适应期',
        quality: 'tempo',
        focus: '延长连续节奏时间，保持动作稳定',
        qualityPlan: {
          title: '2 × 10 分钟阈值跑',
          pattern: '热身 → 2 × 10 分钟稳定节奏（组间慢跑 3 分钟）→ 放松',
          description: '在可控强度下延长节奏段，结束后应能较快恢复。',
        },
      },
      {
        weeks: 1,
        phase: 'base',
        phaseName: '回撤周',
        quality: 'tempo',
        stepBack: true,
        focus: '训练量回落，吸收前两周负荷',
        qualityPlan: {
          title: '20 分钟连续节奏',
          pattern: '热身 → 20 分钟受控连续节奏 → 放松',
          description: '回撤周减少总量，保留一段连续节奏来维持训练感觉。',
        },
      },
      {
        weeks: 1,
        phase: 'build',
        phaseName: '专项提升',
        quality: 'interval',
        focus: '进入专项阶段，建立速度储备',
        qualityPlan: {
          title: '6 × 400 米间歇',
          pattern: '热身 → 6 × 400 米（组间 400 米慢跑）→ 放松',
          description: '首次进入间歇阶段，优先保持每组节奏一致，不要前快后慢。',
        },
      },
      {
        weeks: 1,
        phase: 'build',
        phaseName: '专项提升',
        quality: 'interval',
        focus: '延长间歇距离，提升速度耐力',
        qualityPlan: {
          title: '5 × 800 米间歇',
          pattern: '热身 → 5 × 800 米（组间 400 米慢跑）→ 放松',
          description: '延长单组持续时间，保持可重复的目标节奏与完整动作。',
        },
      },
      {
        weeks: 1,
        phase: 'build',
        phaseName: '回撤周',
        quality: 'interval',
        stepBack: true,
        focus: '第二次回撤，为专项配速蓄力',
        qualityPlan: {
          title: '6 × 400 米轻间歇',
          pattern: '热身 → 6 × 400 米（组间 2 分钟慢跑）→ 放松',
          description: '减少总量与密度，保留速度刺激，让身体为比赛配速课蓄力。',
        },
      },
      {
        weeks: 1,
        phase: 'peak',
        phaseName: '专项提升',
        quality: 'race',
        focus: '引入比赛配速段，建立目标成绩节奏感',
        qualityPlan: {
          title: '3 × 2 公里目标配速',
          pattern: '热身 → 3 × 2 公里目标配速（组间慢跑 3 分钟）→ 放松',
          description: '把速度储备转化为 10 公里专项耐力，重点是均匀控制配速。',
        },
      },
      {
        weeks: 1,
        phase: 'taper',
        phaseName: '赛前减量',
        quality: 'race',
        taper: true,
        focus: '总量下降、强度不减，做 5km 测速',
        qualityPlan: {
          title: '5 公里目标配速测试',
          pattern: '热身 → 5 公里目标配速测试 → 放松',
          description: '进入减量周，缩短总训练量，只用一次短测试保持节奏感。',
        },
      },
    ]),
  },

  'T10-6W': {
    id: 'T10-6W',
    name: '10km 提升 · 赛前 6 周计划',
    targetDistance: '10K',
    durationWeeks: 6,
    runsPerWeek: 3,
    sessionsPerWeek: 4,
    goalTypes: ['improve_10k'],
    volumePolicy: { ...VOLUME_POLICY, weeklyGain: 0.07 },
    sourceRefs: [
      {
        file: '03_Athletics_Ireland_Intermediate_Runners.pdf',
        usedFor: '专项与状态提升阶段划分、回撤周机制',
        version: '15-week plan, 2025',
      },
      {
        file: '04_BAA_Boston_Marathon_Training.html',
        usedFor: '六档配速表与 2 周减量结构',
        version: '页面更新 2025-10-24',
      },
    ],
    blueprint: buildBlueprint([
      { weeks: 2, phase: 'base', phaseName: '基础期', quality: 'tempo', focus: '巩固有氧基础，规范训练节奏' },
      { weeks: 1, phase: 'build', phaseName: '专项期', quality: 'interval', focus: '加入质量课，提升乳酸阈与速度储备' },
      { weeks: 2, phase: 'build', phaseName: '专项期', quality: 'race', focus: '比赛配速段 + 长距离耐力' },
      { weeks: 1, phase: 'taper', phaseName: '赛前减量', quality: 'race', taper: true, focus: '总量指数下降，强度与频次保持不变' },
    ]),
  },

  'T-HM': {
    id: 'T-HM',
    name: '半程马拉松 · 12 周计划',
    targetDistance: 'HM',
    durationWeeks: 12,
    runsPerWeek: 3,
    sessionsPerWeek: 3,
    goalTypes: ['hm_finish'],
    volumePolicy: { ...VOLUME_POLICY, weeklyGain: 0.07, taperFactors: [0.78, 0.75] },
    sourceRefs: [
      {
        file: '02c_World_Athletics_Half_Marathon_Training_Programme.pdf',
        usedFor: '12 周 3 课结构、5km→半马配速换算（+25–35 秒/km）、长距离一律 easy',
        version: 'World Athletics 官方',
      },
      {
        file: '03_Athletics_Ireland_Intermediate_Runners.pdf',
        usedFor: '阶段划分、Step-back week、Taper week',
        version: '15-week plan, 2025',
      },
    ],
    blueprint: buildBlueprint([
      { weeks: 3, phase: 'base', phaseName: '有氧基础', quality: 'aerobic', focus: '建立有氧基础与变速能力' },
      { weeks: 1, phase: 'base', phaseName: '回撤周', quality: 'aerobic', stepBack: true, focus: '训练量回落，保留质量课与长距离' },
      { weeks: 3, phase: 'build', phaseName: '力量与速度', quality: 'tempo', focus: '加入节奏跑与力量，累积专项负荷' },
      { weeks: 1, phase: 'build', phaseName: '回撤周', quality: 'tempo', stepBack: true, focus: '第二次回撤' },
      { weeks: 3, phase: 'build', phaseName: '专项与状态提升', quality: 'race', focus: '比赛配速段递增（2×1km → 5km+2km）' },
      { weeks: 1, phase: 'taper', phaseName: '减量与比赛周', quality: 'race', taper: true, focus: '赛前两周总量指数下降，强度保持' },
    ]),
  },

  'T-MAR-20': {
    id: 'T-MAR-20',
    name: '全程马拉松 · 20 周计划',
    targetDistance: 'MARATHON',
    durationWeeks: 20,
    runsPerWeek: 4,
    sessionsPerWeek: 5,
    goalTypes: ['mar_finish'],
    volumePolicy: { ...VOLUME_POLICY, weeklyGain: 0.06, taperFactors: [0.78, 0.75] },
    sourceRefs: [
      {
        file: '04_BAA_Boston_Marathon_Training.html',
        usedFor: '3 周准备 + 6 周基础 + 9 周专项 + 2 周减量、六档配速表、马拉松模拟跑',
        version: '页面更新 2025-10-24',
      },
      {
        file: '07_ACSM_FITT_VP_Official_Outline.pdf',
        usedFor: '训练量进阶与专项性原则',
        version: 'ACSM Guidelines 11th ed.',
      },
    ],
    blueprint: buildBlueprint([
      { weeks: 3, phase: 'prep', phaseName: '准备期', quality: 'aerobic', focus: '恢复训练一致性，建立跑量基线' },
      { weeks: 5, phase: 'base', phaseName: '基础期', quality: 'tempo', focus: '有氧基础与力量建设，逐步拉高周跑量' },
      { weeks: 1, phase: 'base', phaseName: '回撤周', quality: 'tempo', stepBack: true, focus: '训练量回落，保留质量课与长距离' },
      { weeks: 8, phase: 'specific', phaseName: '专项期', quality: 'interval', focus: '马拉松模拟跑与强度专项' },
      { weeks: 1, phase: 'specific', phaseName: '回撤周', quality: 'interval', stepBack: true, focus: '专项期回撤' },
      { weeks: 2, phase: 'taper', phaseName: '减量期', quality: 'race', taper: true, focus: '赛前 2 周总量指数下降，强度与频次保持不变' },
    ]),
  },

  'T-MAR-16': {
    id: 'T-MAR-16',
    name: '全程马拉松 · 16 周计划（压缩）',
    targetDistance: 'MARATHON',
    durationWeeks: 16,
    runsPerWeek: 4,
    sessionsPerWeek: 5,
    goalTypes: ['mar_finish'],
    volumePolicy: { ...VOLUME_POLICY, weeklyGain: 0.06, taperFactors: [0.78, 0.75] },
    sourceRefs: [
      {
        file: '04_BAA_Boston_Marathon_Training.html',
        usedFor: '依据 20 周结构压缩准备期与减量期',
        version: '页面更新 2025-10-24',
      },
    ],
    blueprint: buildBlueprint([
      { weeks: 2, phase: 'prep', phaseName: '准备期', quality: 'aerobic', focus: '快速建立训练一致性' },
      { weeks: 5, phase: 'base', phaseName: '基础期', quality: 'tempo', focus: '有氧基础与力量建设' },
      { weeks: 1, phase: 'base', phaseName: '回撤周', quality: 'tempo', stepBack: true, focus: '训练量回落' },
      { weeks: 5, phase: 'specific', phaseName: '专项期', quality: 'interval', focus: '马拉松模拟跑与强度专项' },
      { weeks: 1, phase: 'specific', phaseName: '回撤周', quality: 'interval', stepBack: true, focus: '专项期回撤' },
      { weeks: 2, phase: 'taper', phaseName: '减量期', quality: 'race', taper: true, focus: '赛前 2 周减量' },
    ]),
  },
}

/** 目标类型 → 可用模板 */
export const TEMPLATES_BY_GOAL = {
  improve_5k: ['T5-WA'],
  improve_10k: ['T10-8W', 'T10-6W'],
  experience: ['T5-WA', 'T10-8W'],
  hm_finish: ['T-HM'],
  mar_finish: ['T-MAR-20', 'T-MAR-16'],
}

/** 目标类型定义（PRD §1.3.3 四类目标表述） */
export const TARGET_TYPES = {
  improve_5k: { key: 'improve_5k', label: '提升 5km', distance: '5K', weeks: 8, icon: 'timer' },
  improve_10k: { key: 'improve_10k', label: '提升 10km', distance: '10K', weeks: 8, icon: 'sprint' },
  hm_finish: { key: 'hm_finish', label: '半马完赛', distance: 'HM', weeks: 12, icon: 'route' },
  mar_finish: { key: 'mar_finish', label: '全马完赛', distance: 'MARATHON', weeks: 20, icon: 'flag' },
}
