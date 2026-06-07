import { describe, expect, it } from 'vitest'
import { createEmptyLineup } from './roster-format'
import {
  isReliefOnlyPitchingStaff,
  reliefWorkloadFromStats,
  teamWorkloadScore,
} from './pitching-workload'
import type { PitcherStats, Player } from './types'

function closer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'closer',
    personId: 'closer',
    name: 'Test Closer',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '1990s',
    role: 'pitcher',
    positions: ['RP'],
    stats: {
      era: '2.50',
      whip: '1.00',
      so: 100,
      wins: 5,
      gs: 0,
      g: 65,
      reliefGames: 65,
      ip: 70,
    } satisfies PitcherStats,
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 95,
      whip: 95,
      strikeouts: 85,
      wins: 70,
      saves: 90,
      workload: 90,
      overall: 88,
    },
    ...overrides,
  }
}

function starter(): Player {
  return {
    id: 'starter',
    personId: 'starter',
    name: 'Test Starter',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '1990s',
    role: 'pitcher',
    positions: ['SP'],
    stats: {
      era: '3.00',
      whip: '1.10',
      so: 200,
      wins: 15,
      gs: 32,
      g: 33,
      ip: 210,
    } satisfies PitcherStats,
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: 95,
      whip: 95,
      strikeouts: 85,
      wins: 70,
      saves: 50,
      workload: 82,
      overall: 88,
    },
  }
}

describe('reliefWorkloadFromStats', () => {
  it('rewards high availability and durability for workhorse relievers', () => {
    const score = reliefWorkloadFromStats({
      gs: 0,
      g: 70,
      reliefGames: 70,
      ip: 75,
    })
    expect(score).toBeGreaterThan(75)
  })

  it('rates workhorse relievers above occasional short-relief arms', () => {
    const workhorse = reliefWorkloadFromStats({
      gs: 0,
      g: 70,
      reliefGames: 70,
      ip: 75,
    })
    const occasional = reliefWorkloadFromStats({
      gs: 0,
      g: 90,
      reliefGames: 15,
      ip: 8,
    })
    expect(workhorse).toBeGreaterThan(occasional + 15)
  })
})

describe('isReliefOnlyPitchingStaff', () => {
  it('detects a closer-only staff in classic format', () => {
    const lineup = createEmptyLineup()
    lineup.SP = closer()
    expect(isReliefOnlyPitchingStaff(lineup, 'classic')).toBe(true)
  })

  it('does not flag a true starter in the SP slot', () => {
    const lineup = createEmptyLineup()
    lineup.SP = starter()
    expect(isReliefOnlyPitchingStaff(lineup, 'classic')).toBe(false)
  })
})

describe('teamWorkloadScore', () => {
  it('applies a major downgrade for relief-only staffs', () => {
    const lineup = createEmptyLineup()
    lineup.SP = closer()
    lineup.RP = closer({ id: 'closer-2', personId: 'closer-2' })

    const starterLineup = createEmptyLineup()
    starterLineup.SP = starter()
    starterLineup.RP = closer()

    const reliefOnly = teamWorkloadScore(lineup, 'rp')
    const mixed = teamWorkloadScore(starterLineup, 'rp')

    expect(reliefOnly).toBeLessThan(35)
    expect(mixed).toBeGreaterThan(reliefOnly + 30)
  })

  it('caps workload for a reliever miscast in the SP slot', () => {
    const lineup = createEmptyLineup()
    lineup.SP = closer({ ratings: { ...closer().ratings, workload: 95 } })
    lineup.RP = starter()

    const score = teamWorkloadScore(lineup, 'rp')
    expect(score).toBeLessThan(70)
  })
})
