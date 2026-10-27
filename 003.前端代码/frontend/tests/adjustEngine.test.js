import { describe, it, expect } from 'vitest'
import { computeAdjustments, extractSignals } from '../src/domain/engine/adjustEngine.js'
import { generatePlan } from '../src/domain/engine/planEngine.js'
import { buildSummary } from '../src/domain/engine/summaryBuilder.js'
import { DEMO_PROFILE } from '../src/data/demoSeed.js'

const profile = {
  ...DEMO_PROFILE,
  age: 31,
  targetPace: 351,
  targetDistance: '10K',
  weeklyKm: 20,
  availableDays: 3,
  availableMin: 60,
}

const plan = generatePlan(profile)
const currentWeek = plan.weeks[0]
const currentSession = currentWeek.sessions[1] // 质量课

const record = {
  sessionId: currentSession.id,
  week: 1,
  actualDistanceKm: 6.8,
  actualDurationSec: 45 * 60,
  avgPace: 396,
  bestPace: 388,
  pauseCount: 0,
  zoneSeconds: { easy: 900, tempo: 1200 },
}

const base = { plan, record, recentRecords: [], longest30dKm: 8 }

describe('规则引擎（PRD §E2）', () => {
  it('P1：膝/踝/足 疼痛 4–6 → 未来 3 天取消质量课并替换为轻松跑', () => {
    const res = computeAdjustments({
      ...base,
      feedback: { completion: 'mostly', rpe: 7, painScore: 5, painParts: ['膝'], feel: 'fatigued', note: '' },
    })
    const pain = res.adjustments.find((a) => a.reasonCode === 'PAIN_REPLACE')
    expect(pain).toBeTruthy()
    expect(pain.after.type).toBe('easy')
  })

  it('P0：疼痛 ≥7 → 立即暂停计划，下一课次替换为休息 + 拉伸，且不可拒绝', () => {
    const res = computeAdjustments({
      ...base,
      feedback: { completion: 'partial', rpe: 9, painScore: 8, painParts: ['膝'], feel: 'very_hard', note: '' },
    })
    expect(res.safetyNotice).toBeTruthy()
    const stop = res.adjustments.find((a) => a.reasonCode === 'SAFETY_STOP')
    expect(stop).toBeTruthy()
    expect(stop.after.type).toBe('rest')
  })

  it('P2：完成度为未完成 → 下一课次降级、总量 −30%', () => {
    const res = computeAdjustments({
      ...base,
      feedback: { completion: 'none', rpe: 8, painScore: 0, painParts: [], feel: 'fatigued', note: '' },
    })
    const low = res.adjustments.find((a) => a.reasonCode === 'LOW_COMPLETION')
    expect(low).toBeTruthy()
    expect(low.after.distanceKm).toBeLessThan(low.before.distanceKm)
  })

  it('P6：单次跑量超过近 30 天最长 × 1.1 → 拦截并下调', () => {
    const res = computeAdjustments({
      ...base,
      record: { ...record, actualDistanceKm: 11 },
      feedback: { completion: 'full', rpe: 6, painScore: 0, painParts: [], feel: 'normal', note: '' },
    })
    const spike = res.adjustments.find((a) => a.reasonCode === 'SINGLE_SESSION_SPIKE')
    expect(spike).toBeTruthy()
    expect(spike.after.distanceKm).toBeCloseTo(8.8, 1)
  })

  it('P5：实际距离超过计划 115% → 同类型课次回落到计划值', () => {
    const res = computeAdjustments({
      ...base,
      record: { ...record, actualDistanceKm: currentSession.distanceKm * 1.3 },
      feedback: { completion: 'full', rpe: 6, painScore: 0, painParts: [], feel: 'normal', note: '' },
    })
    const over = res.adjustments.find((a) => a.reasonCode === 'OVER_VOLUME')
    expect(over).toBeTruthy()
    expect(over.after.distanceKm).toBeCloseTo(currentSession.distanceKm, 1)
  })

  it('P4：连续 3 次完全完成且无疼痛 → 下周总量进阶（≤+10%）', () => {
    const recent = [1, 2, 3].map(() => ({
      feedback: { completion: 'full', rpe: 6, painScore: 0, painParts: [] },
    }))
    const res = computeAdjustments({
      ...base,
      recentRecords: recent,
      feedback: { completion: 'full', rpe: 6, painScore: 0, painParts: [], feel: 'normal', note: '' },
    })
    const up = res.adjustments.find((a) => a.reasonCode === 'PROGRESS_UP')
    expect(up).toBeTruthy()
    expect(up.after.targetKm).toBeLessThanOrEqual(up.before.targetKm * 1.11)
  })

  it('P11：从自由文本中提取「没时间 / 受伤」信号', () => {
    expect(extractSignals('今天实在没时间，天气又热')[0].type).toBe('no_time')
    expect(extractSignals('左脚踝有点疼')[0].type).toBe('injury')
  })

  it('调整项全部带有原因码与可读理由', () => {
    const res = computeAdjustments({
      ...base,
      feedback: { completion: 'mostly', rpe: 7, painScore: 5, painParts: ['小腿'], feel: 'fatigued', note: '最后 1 公里顶不住了' },
    })
    res.adjustments.forEach((a) => {
      expect(a.reasonCode).toBeTruthy()
      expect(a.reasonText.length).toBeGreaterThan(5)
    })
  })
})

describe('AI 总结（PRD §E1）', () => {
  it('四段式结构完整，且数字来自结构化数据', () => {
    const res = computeAdjustments({
      ...base,
      feedback: { completion: 'mostly', rpe: 7, painScore: 5, painParts: ['小腿'], feel: 'fatigued', note: '小腿发紧' },
    })
    const summary = buildSummary({
      session: currentSession,
      record,
      feedback: { completion: 'mostly', rpe: 7, painScore: 5, painParts: ['小腿'], feel: 'fatigued' },
      adjustments: res.adjustments,
    })
    expect(summary.structure.map((s) => s.key)).toEqual(['replay', 'positive', 'watch', 'next'])
    expect(summary.structure[0].paragraphs.join('')).toContain('6.80km')
    expect(summary.factsSnapshot.actualKm).toBe(6.8)
    expect(summary.factsSnapshot.painScore).toBe(5)
  })

  it('下一步只引用规则引擎给出的调整项', () => {
    const summary = buildSummary({
      session: currentSession,
      record,
      feedback: { completion: 'full', rpe: 6, painScore: 0, painParts: [], feel: 'normal' },
      adjustments: [],
    })
    expect(summary.structure[3].paragraphs[0]).toContain('未触发任何调整规则')
  })
})
