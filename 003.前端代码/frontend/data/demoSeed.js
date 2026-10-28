/**
 * 演示数据 —— PRD v1.2 §9.3「演示数据准备」。
 *
 * 演示账号：123 / 123456，预置 3 周历史训练记录（用于历史与趋势页有内容）。
 * 预置 2 个候选档案账号（进阶 / 有伤病），应对现场问询。
 */

export const DEMO_ACCOUNT = {
  phone: '123',
  password: '123456',
  nickname: '跑者 #8042',
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function plusDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 主演示档案：10km 目标用户（本次 Demo 的主链路） */
export const DEMO_PROFILE = {
  gender: 'male',
  birthYear: 1995,
  heightCm: 175,
  weightKg: 68,
  runningYears: '1-3年',
  runsPerWeek: 3,
  weeklyKm: 20,
  longestRunKm: 8,
  raceHistory: ['5K', '10K'],
  best5kPace: 300, // 5'00"/km
  best10kPace: 390, // 65'00" → 6'30"/km
  bestHmPace: null,
  bestMarPace: null,
  easyPace: 405, // 6'45"/km
  targetType: 'improve_10k',
  targetDistance: '10K',
  targetTime: 3510, // 58'30"，与演示目标配速 5'51"/公里一致
  targetDate: plusDays(56),
  hasRace: true,
  targetPace: 351, // 58'30" → 5'51"/km
  injuries: [{ part: '小腿', active: true, note: '跑后偶尔发紧，已无明显疼痛' }],
  availableDays: 3,
  availableMin: 60,
  terrain: '公路',
  equipment: ['弹力带'],
  screening: { q1: 'yes', q2: [], q3: 'no' },
  aiInferred: ['easyPace'],
}

/** 候选档案：现场问询时切换（PRD §9.3） */
export const DEMO_PROFILES = [
  { key: 'demo', name: '主演示 · 10km 进阶', profile: DEMO_PROFILE },
  {
    key: 'beginner',
    name: '基础 · 10km 保守',
    profile: {
      ...DEMO_PROFILE,
      gender: 'female',
      birthYear: 1996,
      heightCm: 165,
      weightKg: 58,
      runningYears: '<3个月',
      runsPerWeek: 2,
      weeklyKm: 8,
      longestRunKm: 3,
      raceHistory: [],
      best5kPace: null,
      best10kPace: null,
      easyPace: 480,
      targetType: 'improve_10k',
      targetDistance: '10K',
      targetPace: 360,
      targetDate: plusDays(56),
      injuries: [],
      availableDays: 2,
      availableMin: 45,
      screening: { q1: 'no', q2: [], q3: 'no' },
      aiInferred: ['easyPace', 'targetPace'],
    },
  },
  {
    key: 'injured',
    name: '有伤病 · 10km 保守',
    profile: {
      ...DEMO_PROFILE,
      weeklyKm: 12,
      longestRunKm: 5,
      best10kPace: 420,
      easyPace: 450,
      targetPace: 360,
      injuries: [{ part: '膝盖', active: true, note: '跑下楼梯时髌骨有痛感' }],
      screening: { q1: 'yes', q2: [], q3: 'yes' },
    },
  },
]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomItem(items) {
  return items[randomInt(0, items.length - 1)]
}

function randomTerrain() {
  const options = ['公路', '田径跑道', '健身房']
  const selected = options.filter(() => Math.random() > 0.45)
  return selected.length ? selected : [randomItem(options)]
}

/**
 * 随机演示档案：只生成一组合理的跑者输入，不包含任何预设训练计划。
 * 点击“载入演示档案”后，仍由后端 AI 根据这组档案生成计划。
 */
export function createRandomDemoProfile() {
  const gender = randomItem(['male', 'female'])
  const heightCm = gender === 'male' ? randomInt(165, 188) : randomInt(155, 175)
  const weightKg = randomInt(
    Math.max(48, Math.round((heightCm / 100) ** 2 * 18.5)),
    Math.min(100, Math.round((heightCm / 100) ** 2 * 25)),
  )
  const targetMinutes = randomItem([50, 55, 60, 65, 70])
  const bestMinutes = randomItem([null, 58, 62, 65, 68, 72])
  const weeklyKm = randomItem([10, 15, 20, 25, 30])
  const longestRunKm = randomItem([4, 5, 6, 8, 10])
  const easyPace = randomItem([360, 390, 420, 450, 480])

  return {
    gender,
    birthYear: randomInt(1985, 2002),
    heightCm,
    weightKg,
    runningYears: randomItem(['<3个月', '3-12个月', '1-3年']),
    runsPerWeek: randomInt(2, 4),
    weeklyKm,
    longestRunKm,
    raceHistory: bestMinutes ? ['10K'] : [],
    best5kPace: null,
    best10kPace: bestMinutes ? bestMinutes * 6 : null,
    best10kTimeMin: bestMinutes,
    bestHmPace: null,
    bestMarPace: null,
    easyPace,
    targetType: 'improve_10k',
    targetDistance: '10K',
    targetTime: targetMinutes * 60,
    targetTimeInput: `${targetMinutes}:00`,
    targetPace: targetMinutes * 6,
    injuries: [],
    availableDays: randomInt(2, 4),
    availableMin: randomItem([45, 60, 75]),
    terrain: randomTerrain(),
    equipment: [],
    screening: { q1: 'no', q2: ['none'], q3: 'no' },
    aiInferred: [],
  }
}

/** 预置 3 周历史训练记录（历史与趋势页） */
export const DEMO_HISTORY = [
  {
    id: 'rec_seed_1',
    sessionId: 'seed_w1s1',
    date: daysAgo(20),
    type: 'easy',
    title: '轻松跑 · 有氧基础',
    actualDistanceKm: 5.2,
    actualDurationSec: 42 * 60 + 10,
    avgPace: 486,
    bestPace: 470,
    pauseCount: 0,
    status: 'completed',
    feedback: { completion: 'full', rpe: 3, painScore: 0, painParts: [], feel: 'easy', note: '状态不错，配速很稳。' },
  },
  {
    id: 'rec_seed_2',
    sessionId: 'seed_w1s3',
    date: daysAgo(18),
    type: 'long',
    title: '长距离跑 · 耐力打底',
    actualDistanceKm: 6.1,
    actualDurationSec: 50 * 60 + 32,
    avgPace: 495,
    bestPace: 480,
    pauseCount: 0,
    status: 'completed',
    feedback: { completion: 'full', rpe: 4, painScore: 1, painParts: ['小腿'], feel: 'normal', note: '最后 1 公里小腿有点发紧。' },
  },
  {
    id: 'rec_seed_3',
    sessionId: 'seed_w2s2',
    date: daysAgo(14),
    type: 'tempo',
    title: '节奏跑 · 找到舒服配速上限',
    actualDistanceKm: 6.6,
    actualDurationSec: 45 * 60 + 5,
    avgPace: 410,
    bestPace: 395,
    pauseCount: 1,
    status: 'completed',
    feedback: { completion: 'mostly', rpe: 6, painScore: 2, painParts: ['小腿'], feel: 'fatigued', note: '后半段小腿发紧，配速掉了。' },
  },
  {
    id: 'rec_seed_4',
    sessionId: 'seed_w2s4',
    date: daysAgo(11),
    type: 'strength',
    title: '跑者专项力量 · 髋与核心稳定',
    actualDistanceKm: 0,
    actualDurationSec: 40 * 60,
    avgPace: 0,
    bestPace: 0,
    pauseCount: 0,
    status: 'completed',
    feedback: { completion: 'full', rpe: 5, painScore: 0, painParts: [], feel: 'normal', note: '' },
  },
  {
    id: 'rec_seed_5',
    sessionId: 'seed_w3s1',
    date: daysAgo(7),
    type: 'easy',
    title: '轻松跑 · 有氧基础',
    actualDistanceKm: 5.0,
    actualDurationSec: 40 * 60 + 48,
    avgPace: 489,
    bestPace: 476,
    pauseCount: 0,
    status: 'completed',
    feedback: { completion: 'full', rpe: 3, painScore: 0, painParts: [], feel: 'easy', note: '风大，但节奏稳。' },
  },
  {
    id: 'rec_seed_6',
    sessionId: 'seed_w3s2',
    date: daysAgo(4),
    type: 'tempo',
    title: '节奏跑 · 找到舒服配速上限',
    actualDistanceKm: 6.4,
    actualDurationSec: 43 * 60 + 20,
    avgPace: 405,
    bestPace: 392,
    pauseCount: 0,
    status: 'completed',
    feedback: { completion: 'full', rpe: 6, painScore: 1, painParts: ['小腿'], feel: 'normal', note: '比上次稳，后半段没有掉速。' },
  },
]

/** 预置的调整记录（写回闭环留痕） */
export const DEMO_ADJUSTMENT_LOGS = [
  {
    id: 'adj_seed_1',
    date: daysAgo(4),
    reasonCodes: ['PAIN_REPLACE'],
    count: 2,
    decision: 'accepted',
    items: [
      {
        label: '第 3 周 · 周六 · 长距离跑',
        beforeText: '8.0km @ 轻松跑区间',
        afterText: '7.0km @ 轻松跑区间',
        reasonText: '你这次右小腿疼痛 5 分，先让小腿恢复。',
      },
      {
        label: '第 3 周 · 周四 · 节奏跑',
        beforeText: `7.0km @ 6'11"–6'26"`,
        afterText: '5.0km @ 轻松跑区间',
        reasonText: '未来 3 天内取消质量课，替换为轻松跑。',
      },
    ],
  },
]

