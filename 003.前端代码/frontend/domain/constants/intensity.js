/**
 * 强度档定义 —— PRD v1.2 §B1「强度档定义（三锚点体系）」。
 *
 * 三锚点：主观用力（主）+ 配速偏移（副）+ 心率区间（第三轨）。
 * 配速偏移 = 相对目标配速 P（秒/km）的加秒。
 */
export const INTENSITY = {
  recovery: {
    key: 'recovery',
    code: 'Rcv',
    name: '恢复跑',
    shortName: '恢复',
    effort: '极轻松',
    talkTest: '能唱歌',
    rpe: [2, 3],
    paceOffset: [90, 120],
    hrZone: 'Light (30–<40% HRR)',
    color: 'var(--zone-recovery)',
    tailwind: 'text-success bg-success-container',
    isQuality: false,
  },
  easy: {
    key: 'easy',
    code: 'Easy',
    name: '轻松跑',
    shortName: '轻松',
    effort: '轻松，呼吸放松',
    talkTest: '能持续对话',
    rpe: [3, 4],
    paceOffset: [75, 105],
    hrZone: 'Light (30–<40% HRR)',
    color: 'var(--zone-easy)',
    tailwind: 'text-success bg-success-container',
    isQuality: false,
  },
  aerobic: {
    key: 'aerobic',
    code: 'Aero',
    name: '有氧跑',
    shortName: '有氧',
    effort: '稍快',
    talkTest: '能说完整句但不能唱歌',
    rpe: [4, 5],
    paceOffset: [55, 75],
    hrZone: 'Light–Moderate (30–<50% HRR)',
    color: 'var(--zone-aerobic)',
    tailwind: 'text-success bg-success-container',
    isQuality: false,
  },
  long: {
    key: 'long',
    code: 'Long',
    name: '长距离跑',
    shortName: '长距离',
    effort: '轻松',
    talkTest: '能对话',
    rpe: [3, 4],
    paceOffset: [75, 105],
    hrZone: 'Light (30–<40% HRR)',
    color: 'var(--zone-long)',
    tailwind: 'text-info bg-info-container',
    isQuality: false,
  },
  tempo: {
    key: 'tempo',
    code: 'Tempo',
    name: '节奏跑',
    shortName: '节奏',
    effort: '受控用力',
    talkTest: '只能说短句',
    rpe: [6, 7],
    paceOffset: [20, 35],
    hrZone: 'Moderate (40–<60% HRR)',
    color: 'var(--zone-tempo)',
    tailwind: 'text-primary bg-primary-fixed',
    isQuality: true,
  },
  interval: {
    key: 'interval',
    code: 'Int',
    name: '间歇',
    shortName: '间歇',
    effort: '接近最大努力',
    talkTest: '只能蹦词',
    rpe: [7, 9],
    paceOffset: [-10, 10],
    hrZone: 'Vigorous (≥60% HRR)',
    color: 'var(--zone-interval)',
    tailwind: 'text-error bg-error-container',
    isQuality: true,
  },
  race: {
    key: 'race',
    code: 'Race',
    name: '比赛配速',
    shortName: '比赛配速',
    effort: '目标节奏',
    talkTest: '短句',
    rpe: [7, 8],
    paceOffset: [-5, 5],
    hrZone: 'Vigorous (≥60% HRR)',
    color: 'var(--zone-race)',
    tailwind: 'text-on-surface bg-surface-container-highest',
    isQuality: true,
  },
}

/** 强度顺序（用于「降 1 档」） */
export const INTENSITY_ORDER = [
  'recovery',
  'easy',
  'aerobic',
  'long',
  'tempo',
  'interval',
  'race',
]

/** 强度降档（PRD §E2 P2：强度降 1 档） */
export function downgradeLevel(level) {
  const idx = INTENSITY_ORDER.indexOf(level)
  if (idx <= 0) return INTENSITY_ORDER[0]
  return INTENSITY_ORDER[idx - 1]
}

/**
 * 配速偏移缩放系数（按目标距离）。
 *
 * PRD §B1 的偏移表（轻松跑 = P + 75~105 秒/km）源自 B.A.A. 马拉松六档配速表，
 * 是相对马拉松配速的偏移。直接套用到 5km/10km 目标上，会让「轻松跑」比跑者
 * 自然的舒适配速还慢 40 秒/公里以上（例如 10km 目标 5'51" 时算出 7'06"–7'36"，
 * 而该跑者的舒适配速是 6'45"），与「轻松跑 = 有氧基础」的产品意图相矛盾。
 *
 * 因此引擎按目标距离对偏移做等比缩放（全马 1.0 为基准），
 * 使各目标的轻松跑仍落在跑者真实舒适区附近：
 *   10K ×0.70 → 轻松跑 = P + 53~74 秒；5K ×0.55；半马 ×0.85；全马 ×1.00。
 * 缩放系数在计划总览「强度档速查」中随计划一并展示，便于复核。
 */
export const PACE_OFFSET_SCALE = {
  '5K': 0.55,
  '10K': 0.7,
  HM: 0.85,
  MARATHON: 1,
}

/**
 * 由强度档 + 目标配速 P 计算配速区间（秒/km）。
 * @param {string} level 强度档 key
 * @param {number} goalPaceSec 目标配速 P（秒/km）
 * @param {string} [distance] 目标距离（5K / 10K / HM / MARATHON），用于偏移缩放
 */
export function paceRangeOf(level, goalPaceSec, distance = 'MARATHON') {
  const def = INTENSITY[level]
  if (!def || !goalPaceSec) return { low: 0, high: 0 }
  const scale = PACE_OFFSET_SCALE[distance] ?? 1
  return {
    low: goalPaceSec + Math.round(def.paceOffset[0] * scale),
    high: goalPaceSec + Math.round(def.paceOffset[1] * scale),
  }
}

/** 取缩放后的偏移区间（秒），用于展示「强度档速查」 */
export function scaledOffset(level, distance = 'MARATHON') {
  const def = INTENSITY[level]
  const scale = PACE_OFFSET_SCALE[distance] ?? 1
  return [Math.round(def.paceOffset[0] * scale), Math.round(def.paceOffset[1] * scale)]
}
