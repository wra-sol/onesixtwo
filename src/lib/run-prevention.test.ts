import { describe, expect, it } from 'vitest'
import { createEmptyLineup } from './roster-format'
import type { HitterStats, LineupPosition, Player } from './types'
import { calculateRunPrevention } from './run-prevention'

function hitter(overrides: Partial<HitterStats> = {}, id = 'h1'): Player {
  return {
    id,
    personId: id,
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
      saves: 0,
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
    positions: ['SP'],
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
      saves: 50,
      workload: 85,
      overall: eraRating,
    },
  }
}

function fillClassicField(lineup: ReturnType<typeof createEmptyLineup>, fielders: Player[]) {
  const positions: LineupPosition[] = [
    'C',
    '1B',
    '2B',
    '3B',
    'SS',
    'LF',
    'CF',
    'RF',
  ]
  for (const [index, position] of positions.entries()) {
    lineup[position] = fielders[index] ?? fielders[0]!
  }
}

describe('calculateRunPrevention', () => {
  it('subtracts lineup error penalty from pitcher run prevention', () => {
    const lineup = createEmptyLineup()
    fillClassicField(
      lineup,
      Array.from({ length: 8 }, (_, i) => hitter({}, `h${i}`)),
    )
    lineup.SP = pitcher(95)

    const result = calculateRunPrevention(lineup, 'classic')
    expect(result.pitcherValue).toBe(95)
    expect(result.errorPenalty).toBeGreaterThan(0)
    expect(result.value).toBeLessThan(result.pitcherValue)
  })

  it('allows 100 when pitching is elite and defense is clean', () => {
    const lineup = createEmptyLineup()
    fillClassicField(
      lineup,
      Array.from({ length: 8 }, (_, i) =>
        hitter({ errors: 4, fieldingGames: 162 }, `h${i}`),
      ),
    )
    lineup.SP = pitcher(100)

    const result = calculateRunPrevention(lineup, 'classic')
    expect(result.value).toBe(100)
    expect(result.errorPenalty).toBe(0)
  })

  it('includes two-way SP in pitcher run prevention', () => {
    const twoWaySp: Player = {
      id: 'ohtani',
      personId: 'ohtani',
      name: 'Two-Way Star',
      teamId: 'yankees',
      teamName: 'Yankees',
      era: '2010s',
      role: 'two-way',
      positions: ['SP', 'DH'],
      stats: {
        era: '3.00',
        whip: '1.10',
        so: 200,
        wins: 15,
        gs: 30,
      },
      ratings: {
        contact: 80,
        power: 80,
        speed: 70,
        runProduction: 80,
        ops: 80,
        era: 88,
        whip: 85,
        strikeouts: 85,
        wins: 80,
        saves: 50,
        workload: 80,
        overall: 84,
      },
      pitchingRatings: {
        contact: 0,
        power: 0,
        speed: 0,
        runProduction: 0,
        ops: 0,
        era: 88,
        whip: 85,
        strikeouts: 85,
        wins: 80,
        saves: 50,
        workload: 80,
        overall: 84,
      },
    }
    const lineup = createEmptyLineup()
    fillClassicField(
      lineup,
      Array.from({ length: 8 }, (_, i) => hitter({}, `h${i}`)),
    )
    lineup.SP = twoWaySp

    const result = calculateRunPrevention(lineup, 'classic')
    expect(result.pitcherValue).toBe(88)
    expect(result.value).toBeLessThanOrEqual(result.pitcherValue)
  })

  it('excludes DH slot from fielding error penalty', () => {
    const cleanFielders = Array.from({ length: 8 }, (_, i) =>
      hitter({ errors: 4, fieldingGames: 162 }, `field-${i}`),
    )
    const sloppyDh = hitter({ errors: 40, fieldingGames: 162 }, 'dh-sloppy')

    const classic = createEmptyLineup()
    fillClassicField(classic, cleanFielders)
    classic.SP = pitcher(90)

    const withDh = createEmptyLineup()
    fillClassicField(withDh, cleanFielders)
    withDh.DH = sloppyDh
    withDh.SP = pitcher(90)

    const classicResult = calculateRunPrevention(classic, 'classic')
    const dhResult = calculateRunPrevention(withDh, 'dh')

    expect(dhResult.errorPenalty).toBe(classicResult.errorPenalty)
    expect(dhResult.lineupErrorsPer162).toBe(classicResult.lineupErrorsPer162)
    expect(dhResult.value).toBe(classicResult.value)
  })
})
