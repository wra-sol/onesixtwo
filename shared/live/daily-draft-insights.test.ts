import { describe, expect, it } from 'vitest'
import { createEmptyDailyLineup } from './daily-roster'
import {
  eligiblePlayersForPosition,
  eligiblePoolByPosition,
  filledSlotCount,
  openPositionCounts,
  openPositions,
  scarceSlotHints,
  teamUsage,
} from './daily-draft-insights'
import type { DailyMatchupDraftState, LivePlayer } from './live-types'

function hitter(
  id: string,
  teamId: number,
  teamAbbrev: string,
  positions: LivePlayer['positions'],
  overall = 50,
): LivePlayer {
  return {
    id,
    personId: Number(id),
    name: `Player ${id}`,
    teamId,
    teamAbbrev,
    teamName: `Team ${teamAbbrev}`,
    positions,
    role: 'hitter',
    grades: { overall },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function pitcher(
  id: string,
  teamId: number,
  teamAbbrev: string,
  pitcherRoles: NonNullable<LivePlayer['pitcherRoles']>,
  overall = 50,
): LivePlayer {
  return {
    id,
    personId: Number(id),
    name: `Player ${id}`,
    teamId,
    teamAbbrev,
    teamName: `Team ${teamAbbrev}`,
    positions: ['SP'],
    role: 'pitcher',
    grades: { overall },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles,
  }
}

function buildState(
  overrides: Partial<DailyMatchupDraftState> = {},
): DailyMatchupDraftState {
  return {
    mode: 'daily-matchup',
    challengeDate: '2026-06-25',
    targetDate: '2026-06-24',
    opponent: {
      teamId: 999,
      teamAbbrev: 'OPP',
      teamName: 'Opponents',
      lineup: {},
      battingOrder: [],
    },
    lineup: createEmptyDailyLineup(),
    battingOrder: [],
    draftedPlayerIds: [],
    draftedTeamIds: [],
    status: 'drafting',
    salaryCapEnabled: false,
    ...overrides,
  }
}

describe('openPositionCounts / filledSlotCount / openPositions', () => {
  it('empty lineup reports 12 open, 0 filled', () => {
    const lineup = createEmptyDailyLineup()
    const counts = openPositionCounts(lineup)
    expect(counts.C).toEqual({ filled: 0, open: 1 })
    expect(counts.SP).toEqual({ filled: 0, open: 1 })
    expect(filledSlotCount(lineup)).toBe(0)
    expect(openPositions(lineup)).toHaveLength(12)
  })

  it('filled slots are reported correctly', () => {
    const lineup = createEmptyDailyLineup()
    lineup.C = hitter('1', 1, 'LAD', ['C'])
    lineup.SP = pitcher('2', 1, 'LAD', ['SP'])
    expect(filledSlotCount(lineup)).toBe(2)
    expect(openPositions(lineup)).not.toContain('C')
    expect(openPositions(lineup)).not.toContain('SP')
    expect(openPositionCounts(lineup).C).toEqual({ filled: 1, open: 0 })
  })
})

describe('eligiblePlayersForPosition / eligiblePoolByPosition', () => {
  const players: LivePlayer[] = [
    hitter('1', 1, 'LAD', ['C']),
    hitter('2', 2, 'NYY', ['1B']),
    hitter('3', 3, 'BOS', ['OF']),
    pitcher('4', 1, 'LAD', ['SP']),
    pitcher('5', 2, 'NYY', ['RP']),
    pitcher('6', 3, 'BOS', ['CL']),
  ]

  it('eligiblePlayersForPosition returns players who can play a position', () => {
    expect(eligiblePlayersForPosition(players, 'C').map((p) => p.id)).toEqual(['1'])
    expect(eligiblePlayersForPosition(players, 'OF1').map((p) => p.id)).toEqual(['3'])
    expect(eligiblePlayersForPosition(players, 'DH')).toHaveLength(3)
    expect(eligiblePlayersForPosition(players, 'SP').map((p) => p.id)).toEqual(['4'])
  })

  it('eligiblePoolByPosition excludes drafted and opponent-team players', () => {
    const state = buildState({ draftedPlayerIds: ['1'], opponent: { teamId: 999, teamAbbrev: 'OPP', teamName: 'Opponents', lineup: {}, battingOrder: [] } })
    const counts = eligiblePoolByPosition(players, state.draftedPlayerIds, state.opponent.teamId)
    expect(counts.C).toBe(0)
    expect(counts['1B']).toBe(1)
    expect(counts.SP).toBe(1)
  })
})

describe('teamUsage', () => {
  it('marks used and opponent teams, counts remaining players', () => {
    const players: LivePlayer[] = [
      hitter('1', 1, 'LAD', ['C']),
      hitter('2', 1, 'LAD', ['1B']),
      hitter('3', 2, 'NYY', ['SS']),
      hitter('4', 999, 'OPP', ['OF']),
    ]
    const usage = teamUsage(players, [1], 999)
    const lad = usage.find((t) => t.teamId === 1)!
    expect(lad.used).toBe(true)
    expect(lad.remainingPlayers).toBe(0)
    const nyy = usage.find((t) => t.teamId === 2)!
    expect(nyy.used).toBe(false)
    expect(nyy.remainingPlayers).toBe(1)
    const opp = usage.find((t) => t.teamId === 999)!
    expect(opp.isOpponent).toBe(true)
    expect(opp.remainingPlayers).toBe(0)
    expect(usage[0].teamAbbrev.localeCompare(usage[1].teamAbbrev)).toBeLessThanOrEqual(0)
  })
})

describe('scarceSlotHints', () => {
  it('flags open positions with few eligible remaining players', () => {
    const players: LivePlayer[] = [
      hitter('1', 1, 'LAD', ['C']),
      hitter('2', 2, 'NYY', ['C']),
      hitter('3', 3, 'BOS', ['1B']),
    ]
    const lineup = createEmptyDailyLineup()
    const hints = scarceSlotHints(lineup, players, [], 999, 2)
    const cHint = hints.find((h) => h.position === 'C')
    expect(cHint).toBeDefined()
    expect(cHint!.eligibleRemaining).toBe(2)
    const ssHint = hints.find((h) => h.position === 'SS')
    expect(ssHint).toBeDefined()
    expect(ssHint!.eligibleRemaining).toBe(0)
  })

  it('excludes already-filled positions', () => {
    const players: LivePlayer[] = [hitter('1', 1, 'LAD', ['C'])]
    const lineup = createEmptyDailyLineup()
    lineup.C = players[0]!
    const hints = scarceSlotHints(lineup, players, [], 999, 2)
    expect(hints.find((h) => h.position === 'C')).toBeUndefined()
  })
})
