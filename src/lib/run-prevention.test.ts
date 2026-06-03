import { describe, expect, it } from 'vitest'
import type { HitterStats, Player } from './types'
import { calculateRunPrevention } from './run-prevention'

function hitter(overrides: Partial<HitterStats> = {}): Player {
  return {
    id: 'h1',
    personId: 'h1',
    name: 'Test Hitter',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '2000s',
    role: 'hitter',
    positions: ['SS'],
    stats: {
      avg: '.280',
      hr: 20,
      rbi: 80,
      sb: 10,
      ops: '.800',
      g: 162,
      errors: 12,
      fieldingGames: 162,
      ...overrides,
    },
    ratings: {
      contact: 75,
      power: 75,
      speed: 75,
      runProduction: 75,
      ops: 75,
      era: 0,
      whip: 0,
      strikeouts: 0,
      wins: 0,
      workload: 0,
      overall: 75,
    },
  }
}

function pitcher(eraRating: number): Player {
  return {
    id: 'p1',
    personId: 'p1',
    name: 'Test Pitcher',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '2000s',
    role: 'pitcher',
    positions: ['P'],
    stats: {
      era: '3.00',
      whip: '1.10',
      so: 200,
      wins: 15,
      gs: 30,
    },
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: eraRating,
      whip: 85,
      strikeouts: 85,
      wins: 85,
      workload: 85,
      overall: eraRating,
    },
  }
}

describe('calculateRunPrevention', () => {
  it('subtracts lineup error penalty from pitcher run prevention', () => {
    const players = [
      ...Array.from({ length: 8 }, () => hitter()),
      pitcher(95),
    ]
    const result = calculateRunPrevention(players)
    expect(result.pitcherValue).toBe(95)
    expect(result.errorPenalty).toBeGreaterThan(0)
    expect(result.value).toBeLessThan(result.pitcherValue)
  })

  it('allows 100 when pitching is elite and defense is clean', () => {
    const cleanFielders = Array.from({ length: 8 }, () =>
      hitter({ errors: 4, fieldingGames: 162 }),
    )
    const result = calculateRunPrevention([...cleanFielders, pitcher(100)])
    expect(result.value).toBe(100)
    expect(result.errorPenalty).toBe(0)
  })
})
