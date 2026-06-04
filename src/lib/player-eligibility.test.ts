import { describe, expect, it } from 'vitest'
import type { Player, PitcherStats } from './types'
import {
  getPlayerEligiblePositions,
  isReliefEligible,
  isStarterEligible,
  reliefProfileFromStats,
  starterProfileFromStats,
} from './player-eligibility'

function pitcher(overrides: Partial<Player> & { stats: PitcherStats }): Player {
  return {
    id: 'test-pitcher',
    personId: 'test-pitcher',
    name: 'Test Pitcher',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '1990s',
    role: 'pitcher',
    positions: [],
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 80,
      whip: 80,
      strikeouts: 80,
      wins: 80,
      workload: 80,
      overall: 80,
    },
    ...overrides,
  }
}

describe('starterProfileFromStats', () => {
  it('marks high-start workloads as starter profile', () => {
    expect(starterProfileFromStats(35, 40, 5)).toBe(true)
  })

  it('marks pure closers as non-starter profile', () => {
    expect(starterProfileFromStats(0, 60, 60)).toBe(false)
  })
})

describe('reliefProfileFromStats', () => {
  it('marks high-relief workloads as relief profile', () => {
    expect(reliefProfileFromStats(5, 60, 55)).toBe(true)
  })

  it('marks pure starters as non-relief profile', () => {
    expect(reliefProfileFromStats(35, 36, 1)).toBe(false)
  })
})

describe('isStarterEligible / isReliefEligible', () => {
  it('classifies a pure starter', () => {
    const player = pitcher({
      positions: ['SP'],
      stats: { era: '3.00', whip: '1.10', so: 200, wins: 15, gs: 32, g: 33 },
    })
    expect(isStarterEligible(player)).toBe(true)
    expect(isReliefEligible(player)).toBe(false)
  })

  it('classifies a pure closer', () => {
    const player = pitcher({
      positions: ['RP'],
      stats: { era: '2.50', whip: '1.00', so: 100, wins: 5, gs: 0, g: 65, reliefGames: 65 },
    })
    expect(isStarterEligible(player)).toBe(false)
    expect(isReliefEligible(player)).toBe(true)
  })

  it('classifies a swingman as both profiles', () => {
    const player = pitcher({
      positions: ['SP', 'RP'],
      stats: { era: '3.20', whip: '1.15', so: 150, wins: 12, gs: 25, g: 55, reliefGames: 30 },
    })
    expect(isStarterEligible(player)).toBe(true)
    expect(isReliefEligible(player)).toBe(true)
  })
})

describe('getPlayerEligiblePositions', () => {
  it('allows any pitcher in the SP slot', () => {
    const closer = pitcher({
      positions: ['RP'],
      stats: { era: '2.50', whip: '1.00', so: 100, wins: 5, gs: 0, g: 65, reliefGames: 65 },
    })
    expect(getPlayerEligiblePositions(closer, 'classic')).toContain('SP')
  })

  it('restricts RP slot to relief-eligible pitchers', () => {
    const starter = pitcher({
      positions: ['SP'],
      stats: { era: '3.00', whip: '1.10', so: 200, wins: 15, gs: 32, g: 33 },
    })
    expect(getPlayerEligiblePositions(starter, 'rp')).not.toContain('RP')
  })
})
