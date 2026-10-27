import { describe, it, expect } from 'vitest'
import { formatPace, formatDuration, parseDuration, estimateDurationSec } from '../src/domain/utils/pace.js'
import { paceRangeOf, PACE_OFFSET_SCALE } from '../src/domain/constants/intensity.js'

describe('配速与时长格式化', () => {
  it('秒 → mm\'ss"', () => {
    expect(formatPace(351)).toBe("5'51\"")
    expect(formatPace(420)).toBe("7'00\"")
  })

  it('秒 → mm:ss', () => {
    expect(formatDuration(1449)).toBe('24:09')
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('解析多种输入格式', () => {
    expect(parseDuration("58'30\"")).toBe(3510)
    expect(parseDuration('58:30')).toBe(3510)
    expect(parseDuration('58分30秒')).toBe(3510)
    expect(parseDuration('1小时02分')).toBe(3720)
    expect(parseDuration('3510')).toBe(3510)
    expect(parseDuration('abc')).toBe(null)
  })

  it('距离 × 配速 → 时长', () => {
    expect(estimateDurationSec(10, 351)).toBe(3510)
  })
})

describe('配速偏移缩放（引擎适配规则）', () => {
  it('10km 目标的轻松跑落在跑者真实舒适区附近', () => {
    const range = paceRangeOf('easy', 351, '10K')
    expect(range.low).toBe(404)
    expect(range.high).toBe(425)
  })

  it('全马目标使用原始偏移表', () => {
    const range = paceRangeOf('easy', 300, 'MARATHON')
    expect(range.low).toBe(375)
    expect(range.high).toBe(405)
  })

  it('缩放系数按距离递减', () => {
    expect(PACE_OFFSET_SCALE['5K']).toBeLessThan(PACE_OFFSET_SCALE['10K'])
    expect(PACE_OFFSET_SCALE['10K']).toBeLessThan(PACE_OFFSET_SCALE.HM)
    expect(PACE_OFFSET_SCALE.HM).toBeLessThan(PACE_OFFSET_SCALE.MARATHON)
  })
})
