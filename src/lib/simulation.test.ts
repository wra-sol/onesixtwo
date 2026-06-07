import { describe, expect, it } from 'vitest'
import { PITCHING_RELIEF_WEIGHT, PITCHING_STARTER_WEIGHT } from './calibration'
import { buildTeamProfile } from './simulation'
import { createEmptyLineup } from './roster-format'
import type { PitcherStats, Player } from './types'

function pitcher(
  id: string,
  stats: PitcherStats,
  ratings: {
    era: number
    whip: number
    strikeouts: number
    workload: number
  },
): Player {
  return {
    id,
    personId: id,
    name: id,
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '2000s',
    role: 'pitcher',
    positions: ['SP'],
    stats,
    ratings: {
      contact: 0,
      power: 0,
      speed: 0,
      runProduction: 0,
      ops: 0,
      era: ratings.era,
      whip: ratings.whip,
      strikeouts: ratings.strikeouts,
      wins: 70,
      saves: 50,
      workload: ratings.workload,
      overall: 80,
    },
  }
}

describe('buildTeamProfile SP/RP weighting', () => {
  it('blends SP and RP slot ratings when the format includes RP', () => {
    const lineup = createEmptyLineup()
    lineup.SP = pitcher(
      'weak-sp',
      {
        era: '4.50',
        whip: '1.35',
        so: 120,
        wins: 10,
        gs: 30,
        ip: 180,
      },
      { era: 55, whip: 55, strikeouts: 55, workload: 55 },
    )
    lineup.RP = pitcher(
      'elite-rp',
      {
        era: '2.20',
        whip: '0.95',
        so: 80,
        wins: 4,
        gs: 0,
        g: 60,
        reliefGames: 60,
        ip: 70,
      },
      { era: 95, whip: 95, strikeouts: 95, workload: 90 },
    )
    lineup.RP!.positions = ['RP']

    const profile = buildTeamProfile(lineup, 80, 'rp')

    const expectedDominance =
      55 * PITCHING_STARTER_WEIGHT + 95 * PITCHING_RELIEF_WEIGHT
    expect(profile.dominance).toBeCloseTo(expectedDominance, 5)
    expect(profile.dominance).toBeGreaterThan(55)
    expect(profile.dominance).toBeLessThan(95)
  })

  it('uses only the SP slot when the format has no RP slot', () => {
    const lineup = createEmptyLineup()
    lineup.SP = pitcher(
      'starter',
      {
        era: '3.50',
        whip: '1.20',
        so: 200,
        wins: 15,
        gs: 30,
        ip: 200,
      },
      { era: 75, whip: 75, strikeouts: 75, workload: 75 },
    )

    const profile = buildTeamProfile(lineup, 80, 'classic')
    expect(profile.dominance).toBe(75)
  })

  it('crushes workload for a relief-only pitching staff', () => {
    const lineup = createEmptyLineup()
    lineup.SP = pitcher(
      'closer-sp',
      {
        era: '2.20',
        whip: '0.95',
        so: 80,
        wins: 4,
        gs: 0,
        g: 60,
        reliefGames: 60,
        ip: 70,
      },
      { era: 95, whip: 95, strikeouts: 95, workload: 90 },
    )
    lineup.SP!.positions = ['RP']
    lineup.RP = pitcher(
      'closer-rp',
      {
        era: '2.20',
        whip: '0.95',
        so: 80,
        wins: 4,
        gs: 0,
        g: 60,
        reliefGames: 60,
        ip: 70,
      },
      { era: 95, whip: 95, strikeouts: 95, workload: 90 },
    )
    lineup.RP!.positions = ['RP']

    const profile = buildTeamProfile(lineup, 80, 'rp')
    expect(profile.workload).toBeLessThan(35)
  })
})
