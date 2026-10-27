/**
 * 训练前运动风险筛查 —— PRD v1.2 §5.5.1（ACSM 2015 算法 / 2018 修订，PAR-Q+ 简化版）。
 *
 * 这是产品的安全闸门：筛查未通过则不生成训练计划。
 */
export const SCREENING_QUESTIONS = [
  {
    key: 'q1',
    field: 'activity_history',
    title: 'Q1 · 运动习惯',
    question: '你目前每周是否规律进行 ≥30 分钟中等强度运动、每周 ≥3 天、持续 ≥3 个月？',
    required: true,
    options: [
      { value: 'yes', label: '是，规律运动中', icon: 'check_circle' },
      { value: 'no', label: '否，没有规律运动', icon: 'cancel' },
    ],
  },
  {
    key: 'q2',
    field: 'symptoms',
    title: 'Q2 · 症状与疾病',
    question: '你是否存在以下任一症状或已确诊疾病？（可多选）',
    required: true,
    multiple: true,
    options: [
      { value: 'chest_pain', label: '运动时胸痛或不适' },
      { value: 'short_breath', label: '静息或轻微活动即气短' },
      { value: 'dizziness', label: '头晕或晕厥' },
      { value: 'pnd', label: '夜间阵发性呼吸困难' },
      { value: 'edema', label: '踝部水肿' },
      { value: 'palpitation', label: '心悸或心动过速' },
      { value: 'claudication', label: '间歇性跛行' },
      { value: 'murmur', label: '已知心脏杂音' },
      { value: 'fatigue', label: '日常活动异常疲劳' },
      { value: 'none', label: '以上都没有', exclusive: true },
    ],
  },
  {
    key: 'q3',
    field: 'musculoskeletal',
    title: 'Q3 · 肌肉骨骼与医嘱',
    question: '你是否有运动相关肌肉骨骼问题，或近 6 个月内是否被医生要求限制活动？',
    required: true,
    options: [
      { value: 'yes', label: '是，有相关问题或医嘱' },
      { value: 'no', label: '没有' },
    ],
  },
]

/** 症状 key → 中文（用于安全提示话术） */
export const SYMPTOM_LABELS = Object.fromEntries(
  SCREENING_QUESTIONS.find((q) => q.key === 'q2').options.map((o) => [o.value, o.label]),
)

/**
 * 判定筛查结果。
 * @param {{q1?:string, q2?:string[], q3?:string}} answers
 * @returns {{riskLevel:'low'|'moderate'|'medical_confirm', cleared:boolean, symptoms:string[], summary:string, actions:string[]}}
 */
export function evaluateScreening(answers = {}) {
  const q1 = answers.q1
  const q2 = (answers.q2 || []).filter((v) => v !== 'none')
  const q3 = answers.q3

  if (q2.length > 0 || q3 === 'yes') {
    const hits = [...q2.map((v) => SYMPTOM_LABELS[v] || v)]
    if (q3 === 'yes') hits.push('运动相关肌肉骨骼问题或活动限制医嘱')
    return {
      riskLevel: 'medical_confirm',
      cleared: false,
      symptoms: hits,
      summary: '检测到需要医生确认的情况，建议先就医确认后再开始训练。',
      actions: [
        '确诊无碍后可回到建档页继续，档案数据已为你保留。',
        '在医生确认前，我们只为你提供「轻松走跑 + 拉伸」的保守方案。',
      ],
    }
  }

  if (q1 === 'no') {
    return {
      riskLevel: 'moderate',
      cleared: true,
      symptoms: [],
      summary: '你目前没有规律运动习惯，前 2 周先建立基础，强度课从第 3 周起解锁。',
      actions: [
        '第 1–2 周只安排轻松跑与长距离跑。',
        '第 3 周起解锁节奏跑 / 间歇等质量课。',
      ],
    }
  }

  return {
    riskLevel: 'low',
    cleared: true,
    symptoms: [],
    summary: '筛查通过，按标准强度区间生成计划，最高强度可到间歇档。',
    actions: ['正常生成计划，质量课与间歇课均已解锁。'],
  }
}

/** 训练中止标准（PRD §5.5.2） */
export const STOP_SIGNALS = [
  '胸痛或压迫感，或疼痛放射至颈、下颌、手臂、背部',
  '异常呼吸困难、明显气促（与强度不匹配）',
  '头晕、眼前发黑、失去协调',
  '心悸、心律不齐感',
  '突发剧烈关节痛',
]
