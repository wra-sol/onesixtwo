import { describe, expect, it } from 'vitest'
import { createEmptyLineup } from './roster-format'
import { buildScoreExplanation } from './team-scoring'
import { teamWorkloadScore } from './pitching-workload'
import type { LineupPosition, PitcherStats, Player } from './types'

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
      saves: 50,
      workload: 75,
      overall: 88,
    },
  }
}

function fieldHitter(rating: number): Player {
  return {
    id: `h-${rating}`,
    personId: `h-${rating}`,
    name: 'Test Hitter',
    teamId: 'yankees',
    teamName: 'Yankees',
    era: '1990s',
    role: 'hitter',
    positions: ['RF'],
    stats: {
      avg: '.280',
      hr: 20,
      rbi: 80,
      sb: 10,
      ops: '.800',
    },
    ratings: {
      contact: rating,
      power: rating,
      speed: rating,
      runProduction: rating,
      ops: rating,
      era: 0,
      whip: 0,
      strikeouts: 0,
      wins: 0,
      saves: 0,
      workload: 0,
      overall: rating,
    },
  }
}

function starterPitcher(): Player {
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
      workload: 75,
      overall: 88,
    },
  }
}

function lowStartPitcherWithStarterPosition(): Player {
  return {
    ...closer(),
    id: 'low-start-sp',
    personId: 'low-start-sp',
    name: 'Low Start SP',
    positions: ['SP'],
    stats: {
      era: '3.20',
      whip: '1.12',
      so: 120,
      wins: 10,
      gs: 8,
      g: 45,
      reliefGames: 37,
    } satisfies PitcherStats,
  }
}

describe('buildScoreExplanation offense', () => {
  it('does not count pitcher SP toward offense score', () => {
    const lineup = createEmptyLineup()
    const fieldPositions: LineupPosition[] = [
      'C',
      '1B',
      '2B',
      '3B',
      'SS',
      'LF',
      'CF',
      'RF',
    ]
    for (const position of fieldPositions) {
      lineup[position] = fieldHitter(80)
    }
    lineup.SP = starterPitcher()

    const explanation = buildScoreExplanation(lineup, 'classic')
    expect(explanation.offenseScore).toBe(80)
  })
})

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

  it('does not role-fit penalize an SP-positioned pitcher with low starter stats', () => {
    const lineup = createEmptyLineup()
    lineup.SP = lowStartPitcherWithStarterPosition()

    const explanation = buildScoreExplanation(lineup, 'classic')
    expect(explanation.notes).not.toContain(
      'SP slot filled by a non-starter profile (role-fit penalty).',
    )
    expect(explanation.roleFitScore).toBe(100)
  })

  it('notes a relief-only pitching staff and flags low workload', () => {
    const lineup = createEmptyLineup()
    lineup.SP = closer()

    const explanation = buildScoreExplanation(lineup, 'classic')
    expect(explanation.notes).toContain(
      'Relief-only pitching staff (major workload penalty).',
    )
    expect(teamWorkloadScore(lineup, 'classic')).toBeLessThan(35)
  })
})
