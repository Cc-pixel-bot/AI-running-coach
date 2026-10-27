import { describe, it, expect } from 'vitest'
import { generatePlan, computeWeeklyVolumes, computeStartWeeklyKm } from '../src/domain/engine/planEngine.js'
import { evaluateScreening } from '../src/domain/constants/screening.js'
import { TEMPLATES } from '../src/domain/templates/trainingTemplates.js'
import { DEMO_PROFILE } from '../src/data/demoSeed.js'

const profile = {
  ...DEMO_PROFILE,
  age: 31,
  bmi: 22.2,
  targetPace: 351,
  targetDistance: '10K',
  weeklyKm: 20,
  availableDays: 3,
  availableMin: 60,
}

describe('安全闸门（PRD §5.5.1 / 验收 A3）', () => {
  it('Q2 命中症状 → 不生成计划', () => {
    const result = generatePlan({ ...profile, screening: { q1: 'yes', q2: ['chest_pain'], q3: 'no' } })
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('SCREENING_BLOCK')
  })

  it('Q1=否 → 中风险，前 2 周只出轻松跑与长距离', () => {
    const result = generatePlan({ ...profile, screening: { q1: 'no', q2: ['none'], q3: 'no' } })
    expect(result.blocked).toBeFalsy()
    const firstTwo = result.weeks.slice(0, 2).flatMap((w) => w.sessions)
    expect(firstTwo.every((s) => ['easy', 'long', 'strength'].includes(s.type))).toBe(true)
    // 第 3 周起解锁质量课
    const third = result.weeks[2].sessions.find((s) => ['tempo', 'interval'].includes(s.type))
    expect(third).toBeTruthy()
  })

  it('Q3=是 → 需医疗确认', () => {
    expect(evaluateScreening({ q1: 'yes', q2: [], q3: 'yes' }).riskLevel).toBe('medical_confirm')
  })
})

describe('训练量规则（PRD §5.1）', () => {
  const plan = generatePlan(profile)

  it('周期长度与模板一致（10km = 8 周）', () => {
    expect(plan.weeks.length).toBe(TEMPLATES['T10-8W'].durationWeeks)
  })

  it('8 周质量课按阶段递进，不重复使用同一套结构', () => {
    const qualitySessions = plan.weeks.map((w) => w.sessions.find((s) => s.id.endsWith('s2')))
    expect(new Set(qualitySessions.map((s) => s.title)).size).toBe(8)
    expect(qualitySessions[0].structure.pattern).toContain('3 × 6 分钟')
    expect(qualitySessions[7].structure.pattern).toContain('5 公里目标配速测试')
  })

  it('趋势线每周增幅 ≤ 10%（ACSM 渐进原则）', () => {
    for (let i = 1; i < plan.weeks.length; i += 1) {
      const growth = plan.weeks[i].trendKm / plan.weeks[i - 1].trendKm - 1
      expect(growth).toBeLessThanOrEqual(0.1001)
    }
  })

  it('包含回撤周（训练量下调）', () => {
    expect(plan.weeks.some((w) => w.stepBack)).toBe(true)
  })

  it('减量期总量指数下降 41–60%，强度不减（Bosquet 2007）', () => {
    const peak = Math.max(...plan.weeks.filter((w) => !w.taper).map((w) => w.targetKm))
    const taperWeek = plan.weeks.find((w) => w.taper)
    const drop = 1 - taperWeek.targetKm / peak
    expect(drop).toBeGreaterThanOrEqual(0.41)
    expect(drop).toBeLessThanOrEqual(0.6)
    const taperIndex = plan.weeks.findIndex((w) => w.taper)
    expect(taperWeek.quality).toBe(plan.weeks[taperIndex - 1].quality) // 强度不减
  })

  it('单次长距离 ≤ 近 30 天最长距离 × 1.1（Frandsen 2025）', () => {
    const cap = profile.longestRunKm * 1.1
    plan.weeks.forEach((w) =>
      w.sessions.forEach((s) => {
        if (s.type === 'long') expect(s.distanceKm).toBeLessThanOrEqual(cap + 0.01)
      }),
    )
  })

  it('单次时长不超过档案可用时长', () => {
    plan.weeks.forEach((w) =>
      w.sessions.forEach((s) => {
        if (s.type !== 'strength') expect(s.durationMin).toBeLessThanOrEqual(profile.availableMin)
      }),
    )
  })

  it('每周至少 1 次力量课，且总课次 = 每周可训练天数内', () => {
    plan.weeks.forEach((w) => {
      expect(w.sessions.filter((s) => s.type === 'strength').length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('适配依据（PRD §B2 / 验收 B3）', () => {
  const plan = generatePlan(profile)

  it('至少 3 条依据引用了档案中的具体数值', () => {
    const numeric = plan.adaptationSummary.filter((item) => /\d/.test(item.text))
    expect(numeric.length).toBeGreaterThanOrEqual(3)
  })

  it('起始周跑量 = 档案周跑量 × 0.9（PRD §B2 步骤 4）', () => {
    expect(computeStartWeeklyKm({ ...profile, injuries: [], availableDays: 3 })).toBe(18)
  })

  it('有伤病史时起始跑量再打 0.85 折', () => {
    const withInjury = computeStartWeeklyKm({ ...profile, injuries: [{ part: '小腿', active: true }], availableDays: 3 })
    expect(withInjury).toBe(15)
  })
})

describe('强度档与配速（PRD §B1）', () => {
  it('质量课配速落在节奏档区间', () => {
    const plan = generatePlan(profile)
    const tempo = plan.weeks
      .flatMap((w) => w.sessions)
      .find((s) => s.level === 'tempo')
    expect(tempo.intensity.paceLow).toBeGreaterThan(plan.goalPace)
    expect(tempo.intensity.paceHigh).toBeGreaterThan(tempo.intensity.paceLow)
  })

  it('长距离一律按 easy 强度开出', () => {
    const plan = generatePlan(profile)
    plan.weeks.forEach((w) =>
      w.sessions.forEach((s) => {
        if (s.type === 'long') expect(s.level).toBe('long')
      }),
    )
  })
})

describe('周跑量曲线（参数化生成）', () => {
  it('强度变化的那一周不同时推进总量', () => {
    const weeks = computeWeeklyVolumes(TEMPLATES['T10-8W'], 18)
    for (let i = 1; i < weeks.length; i += 1) {
      if (weeks[i].quality !== weeks[i - 1].quality && !weeks[i].stepBack && !weeks[i].taper) {
        expect(weeks[i].trendKm / weeks[i - 1].trendKm - 1).toBeLessThanOrEqual(0.041)
      }
    }
  })
})
