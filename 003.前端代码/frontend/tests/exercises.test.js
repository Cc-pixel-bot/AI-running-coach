import { describe, expect, it } from 'vitest'
import { generatePlan } from '../domain/engine/planEngine.js'

const profile = {
  targetDistance: '10K',
  targetPace: 351,
  easyPace: 405,
  weeklyKm: 20,
  longestRunKm: 8,
  runsPerWeek: 3,
  availableDays: 3,
  availableMin: 60,
  injuries: [],
  screening: { q1: 'yes', q2: [], q3: 'no' },
}

describe('计划课次动作结构', () => {
  it('每个跑步课次都返回具体热身、主体和拉伸内容', () => {
    const plan = generatePlan(profile)
    const session = plan.weeks[0].sessions.find((item) => item.type !== 'strength')

    expect(session.preRunWarmup).toMatchObject({ title: '练前动态激活', duration: 5 })
    expect(session.preRunWarmup.exercises.every((item) => item.id && item.name && item.duration && item.instruction)).toBe(true)
    expect(session.mainRun).toMatchObject({ type: session.type, distanceKm: session.distanceKm, durationMin: session.durationMin })
    expect(session.postRunStretch).toMatchObject({ title: '练后静态拉伸', duration: 5 })
    expect(session.postRunStretch.exercises.every((item) => item.id && item.name && item.duration && item.instruction)).toBe(true)
  })

  it('小腿不适时不安排高负荷动态热身动作', () => {
    const plan = generatePlan({ ...profile, injuries: [{ part: '小腿', active: true }] })
    const quality = plan.weeks[2].sessions.find((item) => ['tempo', 'interval', 'race'].includes(item.type))
    expect(quality.preRunWarmup.exercises.some((item) => ['wu_highknee', 'wu_strides'].includes(item.id))).toBe(false)
  })
})
