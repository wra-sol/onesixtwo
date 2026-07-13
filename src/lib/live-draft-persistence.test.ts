import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDailyLineup } from '@shared/live/daily-roster'
import {
  clearDraft,
  loadDailyDraft,
  rehydrateDailyDraft,
  saveDailyDraft,
  storageKey,
  type PersistedDailyDraft,
} from './live-draft-persistence'
import type { DailyMatchupDraftState, LivePlayer } from '@shared/live/live-types'

function hitter(id: string, teamId: number, teamAbbrev: string, pos: string[], overall = 55): LivePlayer {
  return {
    id,
    personId: Number(id),
    name: `Player ${id}`,
    teamId,
    teamAbbrev,
    teamName: `Team ${teamAbbrev}`,
    positions: pos as LivePlayer['positions'],
    role: 'hitter',
    grades: { overall },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function pitcher(id: string, teamId: number, teamAbbrev: string, roles: ('SP' | 'RP' | 'CL')[]): LivePlayer {
  return {
    id,
    personId: Number(id),
    name: `Player ${id}`,
    teamId,
    teamAbbrev,
    teamName: `Team ${teamAbbrev}`,
    positions: ['SP'],
    role: 'pitcher',
    grades: { overall: 55 },
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: roles,
  }
}

function freshState(): DailyMatchupDraftState {
  return {
    mode: 'daily-matchup',
    challengeDate: '2026-06-25',
    targetDate: '2026-06-24',
    opponent: { teamId: 999, teamAbbrev: 'OPP', teamName: 'Opponents', lineup: {}, battingOrder: [] },
    lineup: createEmptyDailyLineup(),
    battingOrder: [],
    draftedPlayerIds: [],
    draftedTeamIds: [],
    status: 'drafting',
  }
}

function fullPool(): LivePlayer[] {
  return [
    hitter('1', 1, 'LAD', ['C']),
    hitter('2', 2, 'NYY', ['1B']),
    hitter('3', 3, 'BOS', ['2B']),
    hitter('4', 4, 'HOU', ['3B']),
    hitter('5', 5, 'ATL', ['SS']),
    hitter('6', 6, 'PHI', ['OF']),
    hitter('7', 7, 'SD', ['OF']),
    hitter('8', 8, 'SF', ['OF']),
    hitter('9', 9, 'MIL', ['DH']),
    pitcher('10', 10, 'CHC', ['SP']),
    pitcher('11', 11, 'TEX', ['RP']),
    pitcher('12', 12, 'BAL', ['CL']),
  ]
}

describe('live-draft-persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('storageKey is namespaced by mode and challenge date', () => {
    expect(storageKey('daily-matchup', '2026-06-25')).toBe('onesixtwo:daily-matchup:2026-06-25')
  })

  it('save then load round-trips a daily draft', () => {
    const key = storageKey('daily-matchup', '2026-06-25')
    const state = freshState()
    state.lineup.C = hitter('1', 1, 'LAD', ['C'])
    state.lineup.SP = pitcher('10', 10, 'CHC', ['SP'])
    state.draftedPlayerIds = ['1', '10']
    state.draftedTeamIds = [1, 10]
    saveDailyDraft(key, state, '1')
    const loaded = loadDailyDraft(key)
    expect(loaded).not.toBeNull()
    expect(loaded!.challengeDate).toBe('2026-06-25')
    expect(loaded!.positionPlayerIds.C).toBe('1')
    expect(loaded!.positionPlayerIds.SP).toBe('10')
    expect(loaded!.selectedPlayerId).toBe('1')
  })

  it('rehydrateDailyDraft rebuilds state against the fresh player pool', () => {
    const pool = new Map(fullPool().map((p) => [p.id, p]))
    const saved: PersistedDailyDraft = {
      challengeDate: '2026-06-25',
      positionPlayerIds: {
        C: '1', '1B': '2', '2B': '3', '3B': '4', SS: '5',
        OF1: '6', OF2: '7', OF3: '8', DH: '9', SP: '10', RP: '11', CL: '12',
      },
      battingOrderIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      selectedPlayerId: '3',
      status: 'lineup',
    }
    const rehydrated = rehydrateDailyDraft(saved, freshState(), pool)
    expect(rehydrated).not.toBeNull()
    expect(rehydrated!.mode).toBe('daily-matchup')
    expect(rehydrated!.lineup.C!.id).toBe('1')
    expect(rehydrated!.lineup.CL!.id).toBe('12')
    expect(rehydrated!.draftedPlayerIds).toHaveLength(12)
    expect(rehydrated!.draftedTeamIds).toHaveLength(12)
    expect(rehydrated!.battingOrder).toHaveLength(9)
    expect(rehydrated!.status).toBe('lineup')
  })

  it('rehydrateDailyDraft returns null when a persisted player is missing from the pool', () => {
    const pool = new Map(fullPool().slice(0, 6).map((p) => [p.id, p]))
    const saved: PersistedDailyDraft = {
      challengeDate: '2026-06-25',
      positionPlayerIds: {
        C: '1', '1B': '2', '2B': '3', '3B': '4', SS: '5',
        OF1: '6', OF2: '99', OF3: null, DH: null, SP: null, RP: null, CL: null,
      },
      battingOrderIds: [],
      selectedPlayerId: null,
      status: 'drafting',
    }
    expect(rehydrateDailyDraft(saved, freshState(), pool)).toBeNull()
  })

  it('rehydrateDailyDraft returns null on challenge date mismatch', () => {
    const pool = new Map(fullPool().map((p) => [p.id, p]))
    const saved: PersistedDailyDraft = {
      challengeDate: '2026-06-24',
      positionPlayerIds: { C: '1', '1B': null, '2B': null, '3B': null, SS: null, OF1: null, OF2: null, OF3: null, DH: null, SP: null, RP: null, CL: null },
      battingOrderIds: [],
      selectedPlayerId: null,
      status: 'drafting',
    }
    expect(rehydrateDailyDraft(saved, freshState(), pool)).toBeNull()
  })

  it('rehydrateDailyDraft demotes to drafting when an incomplete lineup was saved as lineup status', () => {
    const pool = new Map(fullPool().map((p) => [p.id, p]))
    const saved: PersistedDailyDraft = {
      challengeDate: '2026-06-25',
      positionPlayerIds: {
        C: '1', '1B': null, '2B': null, '3B': null, SS: null,
        OF1: null, OF2: null, OF3: null, DH: null, SP: null, RP: null, CL: null,
      },
      battingOrderIds: [],
      selectedPlayerId: null,
      status: 'lineup',
    }
    const rehydrated = rehydrateDailyDraft(saved, freshState(), pool)
    expect(rehydrated!.status).toBe('drafting')
    expect(rehydrated!.battingOrder).toEqual([])
  })

  it('clearDraft removes the persisted entry', () => {
    const key = storageKey('daily-matchup', '2026-06-25')
    saveDailyDraft(key, freshState(), null)
    expect(loadDailyDraft(key)).not.toBeNull()
    clearDraft(key)
    expect(loadDailyDraft(key)).toBeNull()
  })
})
