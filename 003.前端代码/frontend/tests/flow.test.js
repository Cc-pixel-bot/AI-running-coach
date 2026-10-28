import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlanStore } from '../stores/plan.js'
import { useRunStore } from '../stores/run.js'
import { useProfileStore } from '../stores/profile.js'
import { DEMO_PROFILE } from '../data/demoSeed.js'

vi.mock('../services/authApi.js', () => ({
  generateAiPlanApi: vi.fn(async (_token, profile) => {
    if (profile.screening?.q2?.includes('chest_pain')) {
      return { status: 'blocked', message: '当前风险筛查需要医疗确认' }
    }
    return {
      status: 'completed',
      plan: {
        templateId: 'T10-BASE-3-PLUS',
        templateName: '10 公里基础提升型',
        targetDistance: '10K',
        goalPace: '5分30秒/公里',
        goalTotalSec: profile.targetTotalSec,
        status: 'ready',
        currentWeek: 1,
        totalWeeks: 8,
        weeks: Array.from({ length: 8 }, (_, index) => ({
          week: index + 1,
          phase: '基础提升',
          focus: '逐步提升耐力与配速稳定性',
          totalKm: 24,
          sessions: [
            {
              id: `w${index + 1}s1`,
              week: index + 1,
              dayOffset: 0,
              dayLabel: '第1天',
              status: 'upcoming',
              type: 'tempo',
              title: '节奏跑',
              distanceKm: 6,
              durationMin: 40,
              intensity: '受控',
              description: '保持稳定节奏，完成主体跑步训练内容。',
              structure: '热身 → 节奏跑 → 放松',
              warmup: '练前动态热身内容',
              cooldown: '练后静态拉伸内容',
            },
          ],
        })),
        sourceRefs: [],
      },
    }
  }),
}))

/**
 * 闭环集成测试：档案 → 计划 → 训练 → 反馈 → 调整 → 计划真的变了
 * 对应 PRD §2.1 主流程与验收 E1/E2/E4。
 */
describe('Demo 主链路闭环', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    localStorage.setItem('zhicheng:authToken', JSON.stringify('test-token'))
  })

  it('10km 用户走完整条链路后，计划确实被调整并写回', async () => {
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
    expect(planStore.plan.weeks.flatMap((w) => w.sessions).find((s) => s.id === session.id)?.status).toBe('done')
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
