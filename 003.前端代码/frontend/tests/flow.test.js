import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlanStore } from '../src/stores/plan.js'
import { useRunStore } from '../src/stores/run.js'
import { useProfileStore } from '../src/stores/profile.js'
import { DEMO_PROFILE } from '../src/data/demoSeed.js'

/**
 * 闭环集成测试：档案 → 计划 → 训练 → 反馈 → 调整 → 计划真的变了
 * 对应 PRD §2.1 主流程与验收 E1/E2/E4。
 */
describe('Demo 主链路闭环', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('10km 用户走完整条链路后，计划确实被规则引擎改写', async () => {
    const profile = useProfileStore()
    const planStore = usePlanStore()
    const run = useRunStore()

    // ① 建档
    profile.loadDemo(DEMO_PROFILE)
    expect(profile.isComplete).toBe(true)
    expect(profile.bmi).toBe(22.2)

    // ② 生成计划
    const result = await planStore.generate(profile.toEngineProfile())
    expect(result.blocked).toBeFalsy()
    expect(planStore.plan.weeks.length).toBe(8)
    expect(planStore.pendingAdjustments.length).toBe(0)

    // ③ 真实训练（模拟 GPS 记录）
    const session = planStore.upcomingSessions.find((s) => s.type === 'tempo')
    run.startSession(session, { speedFactor: 60 })
    for (let i = 0; i < 200; i += 1) run._tick()
    const record = run.finish()
    expect(record.actualDistanceKm).toBeGreaterThan(0)
    expect(record.actualDurationSec).toBeGreaterThan(0)

    // ④ 反馈：疼痛 5 分（小腿）
    const planBeforeAdjust = JSON.stringify(planStore.plan)
    await run.submitFeedback({
      completion: 'mostly',
      actualDistanceKm: record.actualDistanceKm,
      actualDurationMin: Math.round(record.actualDurationSec / 60),
      rpe: 7,
      feel: 'fatigued',
      painScore: 5,
      painParts: ['小腿'],
      note: '最后 1 公里实在顶不住了，右小腿发紧。',
    })

    // ⑤ AI 总结
    expect(run.summary.structure.map((s) => s.key)).toEqual(['replay', 'positive', 'watch', 'next'])

    // ⑥ 调整：疼痛 → 质量课降级
    expect(run.lastAdjustments.length).toBeGreaterThan(0)
    const codes = run.lastAdjustments.map((a) => a.reasonCode)
    expect(codes).toContain('PAIN_REPLACE')

    const changedSession = run.lastAdjustments.find((a) => a.reasonCode === 'PAIN_REPLACE')
    expect(changedSession.after.type).toBe('easy')

    // ⑦ 用户采纳 → 计划写回（计划真的变了）
    planStore.decideAdjustments('accepted')
    expect(planStore.adjustmentLogs[0].decision).toBe('accepted')
    expect(planStore.adjustmentLogs[0].count).toBeGreaterThan(0)
    expect(JSON.stringify(planStore.plan)).not.toBe(planBeforeAdjust)

    // ⑧ 课次被标记完成，本周课次全部完成时解锁下一周
    expect(planStore.plan.weeks[0].sessions.some((s) => s.status === 'done')).toBe(true)
  })

  it('安全闸门命中时不生成计划（不进入训练）', async () => {
    const profile = useProfileStore()
    const planStore = usePlanStore()
    profile.loadDemo({ ...DEMO_PROFILE, screening: { q1: 'yes', q2: ['chest_pain'], q3: 'no' } })
    const result = await planStore.generate(profile.toEngineProfile())
    expect(result.blocked).toBe(true)
    expect(planStore.hasPlan).toBe(false)
  })
})
