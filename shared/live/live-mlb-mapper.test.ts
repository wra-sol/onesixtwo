import { describe, expect, it } from 'vitest'
import { selectHighestScoringTeam } from './live-mlb-mapper'

describe('live-mlb-mapper', () => {
  it('selects highest scoring team with tie-breakers', () => {
    const winner = selectHighestScoringTeam([
      {
        teamId: 1,
        teamAbbrev: 'AAA',
        teamName: 'A',
        runs: 10,
        hits: 12,
        opponentRuns: 4,
      },
      {
        teamId: 2,
        teamAbbrev: 'BBB',
        teamName: 'B',
        runs: 10,
        hits: 11,
        opponentRuns: 3,
      },
      {
        teamId: 3,
        teamAbbrev: 'CCC',
        teamName: 'C',
        runs: 9,
        hits: 20,
        opponentRuns: 1,
      },
    ])

    expect(winner?.teamId).toBe(2)
  })
})
