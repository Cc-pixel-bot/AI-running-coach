/**
 * 规则引擎 —— PRD v1.2 §E2「规则引擎动态调整」。
 *
 * 设计原则（PRD 原文）：
 *  - 调整在规则层完成，LLM 只把 reason_code 翻译成人话
 *  - 每条规则都在「宁可少练，不可受伤」与「仍要能出成绩」之间取得可解释的平衡
 *  - P6（单次跑量突增拦截）与 P7（强度/总量冲突回退）是竞品不可能做的两条核心规则
 *
 * 输入：本次 feedback + 近 4 次课次记录 + 近 30 天最长距离 + 当前计划 + 伤病标记
 * 输出：AdjustmentSet（结构化变更集合 + 触发原因码）
 */
import { INTENSITY, downgradeLevel, paceRangeOf } from '../constants/intensity.js'
import { round, deepClone } from '../utils/number.js'

export const REASON_CODES = {
  SAFETY_STOP: { label: '安全中止', tone: 'danger', rejectable: false },
  PAIN_REPLACE: { label: '疼痛替换', tone: 'warn', rejectable: true },
  LOW_COMPLETION: { label: '完成度不足', tone: 'warn', rejectable: true },
  OVERREACH: { label: '过度负荷', tone: 'warn', rejectable: true },
  PROGRESS_UP: { label: '进阶加量', tone: 'good', rejectable: true },
  OVER_VOLUME: { label: '超额完成', tone: 'info', rejectable: true },
  SINGLE_SESSION_SPIKE: { label: '单次跑量突增', tone: 'danger', rejectable: true },
  DUAL_PROGRESSION_CONFLICT: { label: '强度/总量冲突', tone: 'warn', rejectable: true },
  TAPER: { label: '赛前减量', tone: 'info', rejectable: true },
  RACE_WEEK: { label: '比赛周', tone: 'info', rejectable: true },
  RACE_RISK_REVIEW: { label: '赛前风险复核', tone: 'warn', rejectable: true },
  LLM_SIGNAL: { label: '文本信号', tone: 'info', rejectable: true },
}

/** 快照课次关键字段，用于生成 diff */
function snapshot(session) {
  if (!session) return null
  return {
    type: session.type,
    title: session.title,
    distanceKm: session.distanceKm,
    durationMin: session.durationMin,
    pace: session.intensity ? [session.intensity.paceLow, session.intensity.paceHigh] : [0, 0],
    rpe: session.intensity ? session.intensity.rpe : null,
    level: session.level,
  }
}

function findSession(plan, sessionId) {
  for (const week of plan.weeks) {
    const hit = week.sessions.find((s) => s.id === sessionId)
    if (hit) return { week, session: hit }
  }
  return null
}

/** 把后续课次按「当前课次之后」排序 */
function futureSessions(plan, currentWeek, currentSessionIndex) {
  const list = []
  plan.weeks.forEach((w) => {
    w.sessions.forEach((s) => {
      const idx = Number(s.id.split('s')[1])
      if (w.week > currentWeek || (w.week === currentWeek && idx > currentSessionIndex)) {
        list.push({ week: w, session: s, order: w.week * 100 + idx })
      }
    })
  })
  return list.sort((a, b) => a.order - b.order)
}

/** 关键词信号提取（PRD §E2 P11 的简化实现，替代 LLM 抽取） */
export function extractSignals(note = '') {
  const text = String(note)
  const signals = []
  if (/没时间|来不及|太忙|加班|没空/.test(text)) signals.push({ type: 'no_time', text: '时间不足' })
  if (/受伤|崴|扭|疼|痛|不舒服|拉伤/.test(text)) signals.push({ type: 'injury', text: '受伤/疼痛' })
  if (/生病|感冒|发烧|咳嗽/.test(text)) signals.push({ type: 'illness', text: '身体不适' })
  if (/风|雨|热|冷|雾|湿滑/.test(text)) signals.push({ type: 'weather', text: '天气因素' })
  if (/顶不住|撑不住|累|喘/.test(text)) signals.push({ type: 'exhausted', text: '体力透支' })
  return signals
}

/**
 * 计算调整集合。
 * @param {object} params
 * @param {object} params.plan 当前计划
 * @param {object} params.record 本次训练记录 {sessionId, week, sessionIndex, actualDistanceKm, actualDurationSec, ...}
 * @param {object} params.feedback 本次反馈 {completion, rpe, painScore, painParts, feel, note}
 * @param {Array} params.recentRecords 近 4 次课次记录（含 feedback）
 * @param {number} params.longest30dKm 近 30 天单次最长距离
 * @param {number} params.daysToRace 距目标日期天数
 * @param {number} params.weeksSinceBreak 训练中断周数
 * @returns {{plan:object, adjustments:Array, safetyNotice:object|null, reasonCodes:string[]}}
 */
export function computeAdjustments({
  plan,
  record,
  feedback,
  recentRecords = [],
  longest30dKm,
  daysToRace = null,
  weeksSinceBreak = 0,
}) {
  const nextPlan = deepClone(plan)
  const adjustments = []
  const reasonCodes = []
  let safetyNotice = null

  const painScore = feedback.painScore ?? 0
  const painParts = feedback.painParts || []
  const completion = feedback.completion || 'full'
  const rpe = feedback.rpe ?? 5
  const actualDistance = record?.actualDistanceKm ?? 0
  const signals = extractSignals(feedback.note)

  const current = findSession(nextPlan, record?.sessionId)
  const currentWeek = current?.week?.week ?? record?.week ?? 1
  const currentSessionIndex = current ? Number(current.session.id.split('s')[1]) : 1
  const upcoming = futureSessions(nextPlan, currentWeek, currentSessionIndex)

  const addAdjustment = (payload) => {
    adjustments.push({ id: `adj_${adjustments.length + 1}`, ...payload })
    if (!reasonCodes.includes(payload.reasonCode)) reasonCodes.push(payload.reasonCode)
  }

  // ————————————————————————————————————————————
  // P0 安全中止（最高优先级，不可拒绝）
  // ————————————————————————————————————————————
  const chestOrDizzy =
    (feedback.painParts || []).includes('胸闷') ||
    (feedback.painParts || []).includes('头晕') ||
    signals.some((s) => s.type === 'illness')
  if (painScore >= 7 || chestOrDizzy) {
    const restSession = upcoming.find((u) => u.session.type !== 'strength')
    if (restSession) {
      const before = snapshot(restSession.session)
      Object.assign(restSession.session, {
        type: 'rest',
        level: 'recovery',
        title: '休息 + 拉伸（安全中止）',
        distanceKm: 0,
        durationMin: 20,
        description: '因本次出现需要立即停止的信号，下一课次替换为休息与舒缓拉伸，不安排任何跑量。',
        intensity: {
          level: 'recovery',
          effort: '完全不运动',
          talkTest: '—',
          rpe: [1, 1],
          paceLow: 0,
          paceHigh: 0,
          hrZone: '—',
        },
        adaptationNote: '安全优先：本次训练后触发了停止标准，课次已替换为休息 + 拉伸。',
      })
      addAdjustment({
        type: 'REPLACE_SESSION',
        target: {
          week: restSession.week.week,
          sessionId: restSession.session.id,
          label: `第 ${restSession.week.week} 周 · ${restSession.session.dayLabel}`,
        },
        before,
        after: snapshot(restSession.session),
        reasonCode: 'SAFETY_STOP',
        reasonText: painScore >= 7
          ? `你这次疼痛评分 ${painScore}，属于必须立即停止并就医的区间。我已暂停计划，把下一课次替换为休息 + 拉伸。`
          : '你反馈了胸闷/头晕等中止信号，按 ACSM 终止运动标准，训练已暂停并替换为休息 + 拉伸。',
      })
    }
    safetyNotice = {
      title: '已暂停你的训练计划',
      text: painScore >= 7
        ? '疼痛评分达到 7 分，按安全标准必须立即停止高强度内容。建议尽快就医评估，再回到这里继续。'
        : '出现胸闷/头晕等需要立即停止的信号。请先休息并就医确认，确认无碍后再恢复训练。',
      action: '我今天休息',
      rule: 'ACSM 运动测试与处方指南第 11 版 · 终止运动标准',
    }
  }

  // ————————————————————————————————————————————
  // P1 疼痛替换（膝 / 踝 / 足 / 小腿 / 髂胫束，疼痛 4–6）
  //
  // PRD §E2 P1 的表述只列了「膝/踝/足」，但 §5.4 伤病适配表同时覆盖
  // 小腿（跟腱/腓肠肌：暂停间歇与冲刺 1 周 + 离心提踵）与髂胫束。
  // 本引擎按 §5.4 的完整部位表执行，并按部位给出不同的补充动作。
  // ————————————————————————————————————————————
  const PAIN_PARTS = ['膝', '踝', '足', '小腿', '髂胫束']
  const jointPain = painScore >= 4 && painScore <= 6 && painParts.some((p) => PAIN_PARTS.some((k) => p.includes(k)))
  if (jointPain && painScore < 7) {
    const isCalf = painParts.some((p) => p.includes('小腿'))
    const qualityUpcoming = upcoming.find((u) => ['tempo', 'interval', 'race'].includes(u.session.type))
    if (qualityUpcoming) {
      const before = snapshot(qualityUpcoming.session)
      const nextEasy = { ...qualityUpcoming.session }
      nextEasy.type = 'easy'
      nextEasy.level = 'easy'
      nextEasy.title = isCalf ? '轻松跑 · 小腿恢复跑' : '轻松跑 · 关节恢复跑'
      const pace = paceRangeOf('easy', nextPlan.goalPace, nextPlan.targetDistance)
      nextEasy.intensity = {
        level: 'easy',
        effort: INTENSITY.easy.effort,
        talkTest: INTENSITY.easy.talkTest,
        rpe: INTENSITY.easy.rpe,
        paceLow: pace.low,
        paceHigh: pace.high,
        hrZone: INTENSITY.easy.hrZone,
      }
      nextEasy.distanceKm = round(before.distanceKm * 0.75, 1)
      nextEasy.durationMin = Math.round(before.durationMin * 0.75)
      nextEasy.adaptationNote = `疼痛替换：${painParts.join('、')} 疼痛 ${painScore} 分，未来 3 天内质量课改为轻松跑${
        isCalf ? '，并暂停间歇与冲刺 1 周' : '，并追加关节稳定训练'
      }。`
      Object.assign(qualityUpcoming.session, nextEasy)
      addAdjustment({
        type: 'REPLACE_SESSION',
        target: {
          week: qualityUpcoming.week.week,
          sessionId: qualityUpcoming.session.id,
          label: `第 ${qualityUpcoming.week.week} 周 · ${qualityUpcoming.session.dayLabel}`,
        },
        before,
        after: snapshot(qualityUpcoming.session),
        reasonCode: 'PAIN_REPLACE',
        reasonText: isCalf
          ? `你这次${painParts.join('、')}疼痛 ${painScore} 分，属于运动性不适区间。按 §5.4 伤病适配表，我把最近的质量课换成了轻松跑，并暂停间歇与冲刺 1 周，同时在力量课追加离心提踵。`
          : `你这次${painParts.join('、')}疼痛 ${painScore} 分，属于运动性不适区间。未来 3 天内我把质量课换成了轻松跑，并加上关节稳定训练。`,
      })
    }

    // 力量课追加针对性动作（PRD §5.4「替代/补充动作」）
    const strengthSession = upcoming.find((u) => u.session.type === 'strength')
    if (strengthSession) {
      const extra = isCalf
        ? { name: '单腿提踵慢速下放', dose: '3 × 12 / 侧' }
        : painParts.some((p) => p.includes('髂胫束'))
          ? { name: '臀中肌 / 髋外展激活', dose: '3 × 15 / 侧' }
          : { name: '关节稳定训练（单腿站立 + 侧向弓步）', dose: '3 × 10 / 侧' }
      const before = snapshot(strengthSession.session)
      const exercises = strengthSession.session.exercises || []
      if (!exercises.some((e) => e.name === extra.name)) {
        exercises.push(extra)
        strengthSession.session.exercises = exercises
        strengthSession.session.adaptationNote = `${strengthSession.session.adaptationNote || ''} 已追加「${extra.name}」应对${painParts.join('、')}不适。`
      }
      addAdjustment({
        type: 'MODIFY_SESSION',
        target: {
          week: strengthSession.week.week,
          sessionId: strengthSession.session.id,
          label: `第 ${strengthSession.week.week} 周 · ${strengthSession.session.dayLabel}`,
        },
        before,
        after: snapshot(strengthSession.session),
        reasonCode: 'PAIN_REPLACE',
        reasonText: `力量课已追加「${extra.name}」，针对${painParts.join('、')}部位做离心与稳定训练。`,
      })
    }
  }

  // ————————————————————————————————————————————
  // P2 完成度不足 → 下一课次降级为恢复跑，总量 −30%，强度降 1 档
  // ————————————————————————————————————————————
  const plannedDistance = current?.session?.distanceKm || 0
  const lowCompletion = completion === 'none' || (plannedDistance > 0 && actualDistance < plannedDistance * 0.6)
  if (lowCompletion) {
    const next = upcoming.find((u) => u.session.type !== 'strength')
    if (next) {
      const before = snapshot(next.session)
      const newLevel = downgradeLevel(next.session.level)
      const pace = paceRangeOf(newLevel, nextPlan.goalPace, nextPlan.targetDistance)
      next.session.type = newLevel === 'long' ? 'easy' : newLevel
      next.session.level = newLevel
      next.session.distanceKm = round(before.distanceKm * 0.7, 1)
      next.session.durationMin = Math.round(before.durationMin * 0.7)
      next.session.intensity = {
        ...next.session.intensity,
        level: newLevel,
        effort: INTENSITY[newLevel].effort,
        talkTest: INTENSITY[newLevel].talkTest,
        rpe: INTENSITY[newLevel].rpe,
        paceLow: pace.low,
        paceHigh: pace.high,
      }
      next.session.title = `${INTENSITY[newLevel].name} · 降级执行`
      next.session.adaptationNote = '完成度不足：本次课次已按恢复跑降级，总量 −30%、强度降 1 档。'
      addAdjustment({
        type: 'REPLACE_SESSION',
        target: { week: next.week.week, sessionId: next.session.id, label: `第 ${next.week.week} 周 · ${next.session.dayLabel}` },
        before,
        after: snapshot(next.session),
        reasonCode: 'LOW_COMPLETION',
        reasonText: `本次完成度为「${completionLabel(completion)}」，实际 ${actualDistance}km 不足计划的 60%。下一课次我降级为恢复跑，总量 −30%、强度降 1 档。`,
      })
    }
  }

  // ————————————————————————————————————————————
  // P3 过度负荷：连续 2 次 RPE ≥ 目标 RPE + 2
  // ————————————————————————————————————————————
  const targetRpe = current?.session?.intensity?.rpe?.[1] ?? 6
  const overreach = recentRecords.slice(0, 2).filter((r) => (r.feedback?.rpe ?? 0) >= targetRpe + 2).length >= 2
  if (overreach) {
    const week = upcoming.find((u) => u.week.week > currentWeek)?.week || nextPlan.weeks[Math.min(currentWeek, nextPlan.weeks.length - 1)]
    const beforeKm = week.targetKm
    week.targetKm = round(beforeKm * 0.8, 1)
    week.focus = `${week.focus}（因过度负荷下调总量 20%）`
    addAdjustment({
      type: 'MODIFY_WEEK',
      target: { week: week.week, sessionId: null, label: `第 ${week.week} 周整体` },
      before: { targetKm: beforeKm },
      after: { targetKm: week.targetKm },
      reasonCode: 'OVERREACH',
      reasonText: '最近连续两次课次的 RPE 都比目标高出 2 分以上，说明负荷偏高。我把下一周总量下调 20%，质量课降为轻松跑。',
    })
  }

  // ————————————————————————————————————————————
  // P4 连续 3 次完全完成且无疼痛 → 进阶加量
  // ————————————————————————————————————————————
  const lastThree = recentRecords.slice(0, 3)
  const canProgress =
    lastThree.length === 3 &&
    lastThree.every((r) => r.feedback?.completion === 'full' && (r.feedback?.painScore ?? 0) <= 3)
  if (canProgress && painScore <= 3 && !safetyNotice) {
    const week = upcoming.find((u) => u.week.week > currentWeek)?.week
    if (week) {
      const beforeKm = week.targetKm
      const cap = round(beforeKm * 1.05, 1)
      const prevWeekKm = nextPlan.weeks[week.week - 2]?.targetKm || beforeKm
      week.targetKm = Math.min(cap, round(prevWeekKm * 1.1, 1))
      addAdjustment({
        type: 'MODIFY_WEEK',
        target: { week: week.week, sessionId: null, label: `第 ${week.week} 周整体` },
        before: { targetKm: beforeKm },
        after: { targetKm: week.targetKm },
        reasonCode: 'PROGRESS_UP',
        reasonText: `连续 3 次课次完全完成且无疼痛，你已具备进阶条件。我把下一周总量上调到 ${week.targetKm}km（仍受每周 ≤+10% 约束）。`,
      })
    }
  }

  // ————————————————————————————————————————————
  // P5 实际距离 > 计划 115%
  // ————————————————————————————————————————————
  if (plannedDistance > 0 && actualDistance > plannedDistance * 1.15) {
    const sameType = upcoming.find((u) => u.session.type === current?.session?.type)
    if (sameType) {
      const before = snapshot(sameType.session)
      sameType.session.distanceKm = plannedDistance
      sameType.session.durationMin = Math.round(
        (plannedDistance * ((before.pace[0] + before.pace[1]) / 2)) / 60,
      )
      addAdjustment({
        type: 'MODIFY_SESSION',
        target: { week: sameType.week.week, sessionId: sameType.session.id, label: `第 ${sameType.week.week} 周 · ${sameType.session.dayLabel}` },
        before,
        after: snapshot(sameType.session),
        reasonCode: 'OVER_VOLUME',
        reasonText: `本次你跑到了计划的 ${Math.round((actualDistance / plannedDistance) * 100)}%，超出计划 15% 以上。我把下一节同类型课次的目标调回计划值，避免负荷失控。`,
      })
    }
  }

  // ————————————————————————————————————————————
  // P6 单次跑量突增拦截（Frandsen 2025 BJSM）
  // ————————————————————————————————————————————
  const cap30d = round((longest30dKm || 8) * 1.1, 1)
  if (actualDistance > cap30d) {
    const next = upcoming.find((u) => u.session.type !== 'strength')
    if (next) {
      const before = snapshot(next.session)
      next.session.distanceKm = cap30d
      next.session.durationMin = Math.round((cap30d * ((before.pace[0] + before.pace[1]) / 2)) / 60)
      next.session.adaptationNote = `单次跑量上限拦截：${before.distanceKm}km → ${cap30d}km（近 30 天最长 ${longest30dKm}km × 1.1）。`
      addAdjustment({
        type: 'MODIFY_SESSION',
        target: { week: next.week.week, sessionId: next.session.id, label: `第 ${next.week.week} 周 · ${next.session.dayLabel}` },
        before,
        after: snapshot(next.session),
        reasonCode: 'SINGLE_SESSION_SPIKE',
        reasonText: `本次单次跑量 ${actualDistance}km，超过近 30 天最长距离（${longest30dKm}km）的 1.1 倍。数据显示单次超量 10–30% 会让伤病风险上升约 64%，所以我把下一课次截到 ${cap30d}km。`,
      })
    }
  }

  // ————————————————————————————————————————————
  // P7 强度与总量同时推进 → 回退跑量增量
  // ————————————————————————————————————————————
  nextPlan.weeks.forEach((w, index) => {
    if (index === 0) return
    const prev = nextPlan.weeks[index - 1]
    const prevQuality = prev.quality
    const qualityUpgraded = prevQuality !== w.quality && ['interval', 'race'].includes(w.quality)
    const volumeUp = w.targetKm > prev.trendKm
    if (qualityUpgraded && volumeUp) {
      const before = { targetKm: w.targetKm }
      w.targetKm = prev.trendKm
      addAdjustment({
        type: 'MODIFY_WEEK',
        target: { week: w.week, sessionId: null, label: `第 ${w.week} 周整体` },
        before,
        after: { targetKm: w.targetKm },
        reasonCode: 'DUAL_PROGRESSION_CONFLICT',
        reasonText: `第 ${w.week} 周同时出现跑量上调与质量课提速。同一周只推进一个变量，我回退了这一周的跑量增量，保留强度提升。`,
      })
    }
  })

  // ————————————————————————————————————————————
  // P8 / P9 / P10 赛前规则
  // ————————————————————————————————————————————
  if (daysToRace !== null && daysToRace <= 3) {
    nextPlan.weeks.forEach((w) =>
      w.sessions.forEach((s) => {
        if (['tempo', 'interval'].includes(s.type)) {
          const before = snapshot(s)
          s.type = 'easy'
          s.level = 'easy'
          s.title = '轻松跑 · 赛前保持'
          s.intensity = { ...s.intensity, level: 'easy', rpe: INTENSITY.easy.rpe }
          s.adaptationNote = '比赛周：取消质量课，只保留轻松跑与短距离比赛配速段。'
          addAdjustment({
            type: 'REPLACE_SESSION',
            target: { week: w.week, sessionId: s.id, label: `第 ${w.week} 周 · ${s.dayLabel}` },
            before,
            after: snapshot(s),
            reasonCode: 'RACE_WEEK',
            reasonText: '距比赛只剩 3 天以内，质量课已取消，只保留轻松跑与短距离比赛配速段。',
          })
        }
      }),
    )
  } else if (daysToRace !== null && daysToRace <= 14) {
    const week = nextPlan.weeks.find((w) => w.week > currentWeek)
    if (week) {
      const before = { targetKm: week.targetKm }
      week.targetKm = round(week.targetKm * 0.55, 1)
      addAdjustment({
        type: 'MODIFY_WEEK',
        target: { week: week.week, sessionId: null, label: `第 ${week.week} 周整体` },
        before,
        after: { targetKm: week.targetKm },
        reasonCode: 'TAPER',
        reasonText: `距目标日期还有 ${daysToRace} 天，进入减量期：总量指数下降约 45%，但强度与频次保持不变（强度下调反而无益）。`,
      })
    }
  }

  if (daysToRace !== null && daysToRace <= 7 && weeksSinceBreak > 2) {
    addAdjustment({
      type: 'MODIFY_PLAN',
      target: { week: null, sessionId: null, label: '整体计划' },
      before: { status: 'active' },
      after: { status: 'conservative' },
      reasonCode: 'RACE_RISK_REVIEW',
      reasonText: `距比赛 ${daysToRace} 天且训练中断超过 ${weeksSinceBreak} 周，我切换到保守版：只保留轻松跑 + 一次短质量课，并建议下调赛事目标或改期。`,
    })
  }

  // ————————————————————————————————————————————
  // P11 自由文本信号
  // ————————————————————————————————————————————
  if (signals.length) {
    const noTime = signals.find((s) => s.type === 'no_time')
    const injurySignal = signals.find((s) => s.type === 'injury')
    if (noTime) {
      const next = upcoming.find((u) => u.session.type !== 'strength')
      if (next) {
        const before = snapshot(next.session)
        next.session.distanceKm = round(before.distanceKm * 0.8, 1)
        next.session.durationMin = Math.round(before.durationMin * 0.8)
        next.session.adaptationNote = '时间不足：下一课次总量下调 20%，保证质量与恢复。'
        addAdjustment({
          type: 'MODIFY_SESSION',
          target: { week: next.week.week, sessionId: next.session.id, label: `第 ${next.week.week} 周 · ${next.session.dayLabel}` },
          before,
          after: snapshot(next.session),
          reasonCode: 'LLM_SIGNAL',
          reasonText: '你在备注里提到时间不够，我把下一课次总量下调 20%，保证跑量不会因为赶时间而变形。',
        })
      }
    } else if (injurySignal && !adjustments.some((a) => a.reasonCode === 'PAIN_REPLACE')) {
      addAdjustment({
        type: 'MODIFY_SESSION',
        target: { week: currentWeek, sessionId: null, label: '本次课次备注' },
        before: {},
        after: {},
        reasonCode: 'LLM_SIGNAL',
        reasonText: '你的备注里提到了受伤。我已把本周剩余课次强度下调，并建议先确认伤情再恢复。',
      })
    }
  }

  return { plan: nextPlan, adjustments, safetyNotice, reasonCodes }
}

export function completionLabel(completion) {
  return { full: '完全完成', mostly: '基本完成', partial: '部分完成', none: '未完成' }[completion] || completion
}

