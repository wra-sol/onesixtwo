import { describe, expect, it } from 'vitest'
import { createEmptyLineup } from './roster-format'
import { buildScoreExplanation } from './team-scoring'
import type { PitcherStats, Player } from './types'

function closer(): Player {
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
      workload: 75,
      overall: 88,
    },
  }
}

describe('buildScoreExplanation role fit', () => {
  it('penalizes a non-starter profile in the SP slot', () => {
    const lineup = createEmptyLineup()
    lineup.SP = closer()

    const explanation = buildScoreExplanation(lineup, 'classic')
    expect(explanation.notes).toContain(
      'SP slot filled by a non-starter profile (role-fit penalty).',
    )
    expect(explanation.roleFitScore).toBeLessThan(100)
  })
})
