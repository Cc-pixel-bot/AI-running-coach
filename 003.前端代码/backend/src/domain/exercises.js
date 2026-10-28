/**
 * 后端动作注册表。
 * AI 只能引用这里存在的 ID；名称、剂量和动作说明由注册表回填，避免模型自由编造动作。
 */
const WARMUP_LIBRARY = [
  { id: 'wu_walk', name: '快走 / 轻松慢跑', duration: '3–5 分钟', instruction: '呼吸放松，逐步升温，不进入训练强度', applies: ['all'], risk: 'low' },
  { id: 'wu_ankle', name: '踝绕环 + 提踵', duration: '每侧 10 次 + 提踵 15 次', instruction: '动作慢而可控，脚掌三点支撑；不塌踝', applies: ['all'], risk: 'low' },
  { id: 'wu_swing', name: '摆腿（前后 / 左右）', duration: '每侧 10 次', instruction: '扶稳支撑物，骨盆保持正对前方，不甩动', applies: ['tempo', 'interval', 'race', 'long'], risk: 'low' },
  { id: 'wu_lunge', name: '动态弓步 + 转体', duration: '每侧 6–8 次', instruction: '前膝对准脚尖，幅度以无痛为准，躯干自然转动', applies: ['tempo', 'interval', 'race'], risk: 'medium' },
  { id: 'wu_highknee', name: '高抬腿 / 后踢腿', duration: '各 20 秒 × 2 组', instruction: '小步幅、轻落地、身体直立；不追求抬腿高度', applies: ['tempo', 'interval', 'race'], risk: 'medium' },
  { id: 'wu_strides', name: '渐进加速跑 strides', duration: '4–6 次 × 15–20 秒，间隔慢走', instruction: '从轻松到约 70–85% 主观速度，不冲刺；出现疼痛立即停止', applies: ['interval', 'tempo', 'race'], risk: 'high' },
]

const COOLDOWN_LIBRARY = [
  { id: 'cd_calf', name: '小腿腓肠肌拉伸', duration: '每侧 15–20 秒 × 2', instruction: '后脚跟着地，脚尖朝前，身体前倾至轻微牵拉', applies: ['all'] },
  { id: 'cd_quad', name: '股四头肌拉伸', duration: '每侧 15–20 秒 × 2', instruction: '膝盖并拢，骨盆保持中立，不要塌腰', applies: ['all'] },
  { id: 'cd_hamstring', name: '腘绳肌拉伸', duration: '每侧 15–20 秒 × 2', instruction: '背部自然，髋部折叠；不弓背硬压', applies: ['long', 'tempo', 'interval', 'race'] },
  { id: 'cd_glute', name: '臀肌 / 梨状肌拉伸', duration: '每侧 15–20 秒 × 2', instruction: '仰卧抱腿或交叉抱腿，保持呼吸，不拉扯膝关节', applies: ['all'] },
  { id: 'cd_hipflexor', name: '髋屈肌拉伸', duration: '每侧 15–20 秒 × 2', instruction: '半跪，收紧腹部并轻收骨盆，避免腰部过伸', applies: ['all'] },
]

const ALL = new Map([...WARMUP_LIBRARY, ...COOLDOWN_LIBRARY].map((item) => [item.id, item]))

export function getActionCatalog() {
  return [...ALL.values()].map(({ id, applies, risk }) => ({ id, applies, risk }))
}

/**
 * 将模型选择的动作编号展开为应用内统一的动作内容。
 * AI 只负责按课次选择动作，名称、剂量和执行要点始终取自注册表。
 */
export function materializeExerciseSection(section, kind) {
  if (!section || typeof section !== 'object') return section
  const isWarmup = kind === 'warmup'
  const expectedPrefix = isWarmup ? 'wu_' : 'cd_'
  const libraryTitle = isWarmup ? '练前动态激活' : '练后静态拉伸'
  const rawExercises = Array.isArray(section.exercises) ? section.exercises : []
  return {
    title: libraryTitle,
    duration: 5,
    exercises: rawExercises.map((raw) => {
      const id = typeof raw === 'string' ? raw : raw?.id
      const item = ALL.get(id)
      if (!item || !id.startsWith(expectedPrefix)) return { id: id || '' }
      return toExercise(item)
    }),
  }
}

export function materializePlanExercises(plan) {
  if (!plan || !Array.isArray(plan.weeks)) return plan
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      sessions: (week.sessions || []).map((session) => {
        if (session.type === 'strength') return session
        const preRunWarmup = materializeExerciseSection(session.preRunWarmup, 'warmup')
        const postRunStretch = materializeExerciseSection(session.postRunStretch, 'cooldown')
        return {
          ...session,
          preRunWarmup,
          postRunStretch,
          // 兼容现有数据库字段和旧版前端读取方式。
          warmup: preRunWarmup?.exercises || [],
          cooldown: postRunStretch?.exercises || [],
        }
      }),
    })),
  }
}

function activeInjuryParts(profile = {}) {
  return (profile.injuries || []).filter((item) => item?.active !== false).map((item) => item.part).filter(Boolean)
}

function toExercise(item) {
  return {
    id: item.id,
    name: item.name,
    duration: item.duration,
    instruction: item.instruction,
    // 兼容当前前端组件字段
    dose: item.duration,
    points: item.instruction,
  }
}

function selectWarmup(type, profile = {}) {
  const injuries = activeInjuryParts(profile)
  const highLoadBlocked = injuries.some((part) => ['小腿', '足部', '膝盖'].includes(part))
  const preferred = type === 'interval'
    ? ['wu_walk', 'wu_ankle', 'wu_swing', 'wu_lunge', 'wu_highknee', 'wu_strides']
    : type === 'tempo' || type === 'race'
      ? ['wu_walk', 'wu_ankle', 'wu_swing', 'wu_lunge']
      : type === 'long'
        ? ['wu_walk', 'wu_ankle', 'wu_swing']
        : ['wu_walk', 'wu_ankle']
  return preferred
    .filter((id) => !(highLoadBlocked && ['wu_highknee', 'wu_strides'].includes(id)))
    .map((id) => ALL.get(id))
    .filter(Boolean)
    .map(toExercise)
}

function selectCooldown(type, profile = {}) {
  const preferred = type === 'easy' || type === 'recovery'
    ? ['cd_calf', 'cd_quad', 'cd_hipflexor']
    : ['cd_calf', 'cd_quad', 'cd_hamstring', 'cd_glute', 'cd_hipflexor']
  return preferred.map((id) => ALL.get(id)).filter(Boolean).map(toExercise)
}

export function buildSessionContent({ type = 'easy', profile = {}, distanceKm = 0, durationMin = 0, paceLow = 0, paceHigh = 0, structure = null }) {
  const preRunWarmup = { title: '练前动态激活', duration: 5, exercises: selectWarmup(type, profile) }
  const postRunStretch = { title: '练后静态拉伸', duration: 5, exercises: selectCooldown(type, profile) }
  const mainRun = {
    type,
    distanceKm: Number(distanceKm),
    durationMin: Number(durationMin),
    pace: paceLow && paceHigh ? `${formatPace(paceLow)}-${formatPace(paceHigh)}/公里` : null,
    structure: structure || '主体跑步训练',
  }
  return {
    preRunWarmup,
    mainRun,
    postRunStretch,
    // 当前前端与数据库字段兼容别名
    warmup: preRunWarmup.exercises,
    cooldown: postRunStretch.exercises,
  }
}

export function validateExerciseSection(section, kind, errors, label, profile = {}, sessionType = '') {
  if (!section || typeof section !== 'object') {
    errors.push(`${label}缺少结构`)
    return
  }
  if (!Number.isFinite(Number(section.duration)) || Number(section.duration) <= 0 || Number(section.duration) > 15) {
    errors.push(`${label}总时长无效或超过 15 分钟`)
  }
  if (!Array.isArray(section.exercises) || section.exercises.length === 0) {
    errors.push(`${label}缺少具体动作`)
    return
  }
  for (const exercise of section.exercises) {
    const known = ALL.get(exercise?.id)
    if (!known) errors.push(`${label}包含不存在的动作 ID：${exercise?.id || '空'}`)
    if (known && !known.id.startsWith(kind === 'warmup' ? 'wu_' : 'cd_')) errors.push(`${label}动作类型不匹配：${known.id}`)
    if (known && !known.applies.includes('all') && !known.applies.includes(sessionType)) errors.push(`${label}动作不适用于当前训练类型：${known.id}`)
    if (known && exercise.name !== known.name) errors.push(`${label}动作名称与动作库不一致：${known.id}`)
    if (known && !String(exercise.duration || '').trim()) errors.push(`${label}动作缺少剂量：${known.id}`)
    if (known && !String(exercise.instruction || '').trim()) errors.push(`${label}动作缺少说明：${known.id}`)
    const injuryParts = activeInjuryParts(profile)
    if (kind === 'warmup' && injuryParts.some((part) => ['小腿', '足部', '膝盖'].includes(part)) && ['wu_highknee', 'wu_strides'].includes(exercise?.id)) {
      errors.push(`${label}在${injuryParts.join('、')}不适时包含被禁用的高负荷动作：${exercise.id}`)
    }
  }
}

export function isKnownExercise(id) {
  return ALL.has(id)
}

function formatPace(seconds) {
  const minutes = Math.floor(Number(seconds) / 60)
  const remainder = String(Math.round(Number(seconds) % 60)).padStart(2, '0')
  return `${minutes}'${remainder}''`
}
