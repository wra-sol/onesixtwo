import { describe, expect, it } from 'vitest'
import {
  continuousToDisplayGrade,
  formatGrade,
  gradeFromPercentile,
  percentileToContinuous,
} from './live-grades'

describe('live-grades', () => {
  it('maps percentiles to continuous grades', () => {
    expect(percentileToContinuous(0.97)).toBeGreaterThanOrEqual(78)
    expect(percentileToContinuous(0.5)).toBeGreaterThanOrEqual(48)
    expect(percentileToContinuous(0.5)).toBeLessThanOrEqual(52)
  })

  it('rounds to display grades', () => {
    expect(continuousToDisplayGrade(63)).toBe(60)
    expect(continuousToDisplayGrade(67)).toBe(70)
  })

  it('formats grade labels', () => {
    expect(formatGrade(72)).toContain('70')
    expect(formatGrade(72)).toContain('Plus-Plus')
  })

  it('ranks within league values', () => {
    const league = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(gradeFromPercentile(10, league)).toBeGreaterThan(
      gradeFromPercentile(1, league),
    )
  })
})
