import { describe, expect, it } from 'vitest'
import {
  HITTER_AVG_ANCHORS,
  lineupErrorPenalty,
  PITCHER_ERA_ANCHORS,
  scoreFromAnchors,
} from './rating-anchors'

describe('scoreFromAnchors', () => {
  it('maps median hitter AVG to 70', () => {
    const score = scoreFromAnchors(0.267, HITTER_AVG_ANCHORS)
    expect(score).toBe(70)
  })

  it('maps elite hitter AVG to 100', () => {
    const score = scoreFromAnchors(0.323, HITTER_AVG_ANCHORS)
    expect(score).toBe(100)
  })

  it('maps 3.00 ERA to strong run prevention (~86)', () => {
    const score = scoreFromAnchors(3.0, PITCHER_ERA_ANCHORS, {
      lowerIsBetter: true,
    })
    expect(score).toBe(86)
  })

  it('maps elite ERA to 100', () => {
    const score = scoreFromAnchors(2.31, PITCHER_ERA_ANCHORS, {
      lowerIsBetter: true,
    })
    expect(score).toBe(100)
  })

  it('interpolates between anchors', () => {
    const score = scoreFromAnchors(0.275, HITTER_AVG_ANCHORS)
    expect(score).toBeGreaterThan(70)
    expect(score).toBeLessThan(80)
  })
})

describe('lineupErrorPenalty', () => {
  it('gives no penalty for clean defense', () => {
    expect(lineupErrorPenalty(67)).toBe(0)
  })

  it('adds meaningful penalty for sloppy defense', () => {
    expect(lineupErrorPenalty(130)).toBeGreaterThanOrEqual(8)
  })

  it('caps penalty at 12', () => {
    expect(lineupErrorPenalty(200)).toBeLessThanOrEqual(12)
  })
})
