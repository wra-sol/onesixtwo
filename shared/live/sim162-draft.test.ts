import { describe, expect, it } from 'vitest'
import {
  assignSim162Player,
  autoFillRemaining,
  autoFillSuggest,
  createSim162DraftState,
  getSim162DisabledReason,
  isSim162RosterComplete,
  SIM162_TOTAL_PICKS,
  type Sim162DraftState,
} from './sim162-draft'
import {
  ROSTER25_POSITION_SLOTS,
  roster25IsComplete,
  roster25OpenSlots,
  roster25Players,
  type Roster25Slot,
} from './roster25'
import type { LivePlayer, LivePlayerPosition, PitcherRoleSlot } from './live-types'

const SLOT_POSITION_KEY: Record<Roster25Slot, LivePlayerPosition> = {
  C1: 'C',
  C2: 'C',
  '1B': '1B',
  '2B': '2B',
  '3B': '3B',
  SS: 'SS',
  LF: 'LF',
  CF: 'CF',
  RF: 'RF',
  DH: 'DH',
  BENCH1: '1B',
  BENCH2: '2B',
  BENCH3: '3B',
  SP1: 'SP',
  SP2: 'SP',
  SP3: 'SP',
  SP4: 'SP',
  SP5: 'SP',
  RP1: 'RP',
  RP2: 'RP',
  RP3: 'RP',
  RP4: 'RP',
  RP5: 'RP',
  RP6: 'RP',
  CL: 'CL',
}

function buildSim162Pool(teamCount = 30, includeCatchers = true): LivePlayer[] {
  const players: LivePlayer[] = []
  for (let t = 0; t < teamCount; t++) {
    const teamId = 200 + t
    const abbrev = `T${t}`
    const overall = 50 + t
    const hitter = (pos: LivePlayerPosition) => {
      if (pos === 'C' && !includeCatchers) return
      players.push({
        id: `p-${teamId}-${pos}`,
        personId: teamId * 1000 + pos.charCodeAt(0),
        name: `${abbrev} ${pos}`,
        teamId,
        teamAbbrev: abbrev,
        teamName: `${abbrev} Team`,
        positions: [pos],
        role: 'hitter',
        grades: { overall },
        appearedOnTargetDate: true,
        isFallback: false,
      })
    }
    const pitcher = (role: PitcherRoleSlot) => {
      players.push({
        id: `p-${teamId}-${role}`,
        personId: teamId * 1000 + role.charCodeAt(0),
        name: `${abbrev} ${role}`,
        teamId,
        teamAbbrev: abbrev,
        teamName: `${abbrev} Team`,
        positions: [role],
        role: 'pitcher',
        grades: { overall },
        appearedOnTargetDate: true,
        isFallback: false,
        pitcherRoles: [role],
      })
    }
    hitter('C')
    hitter('1B')
    hitter('2B')
    hitter('3B')
    hitter('SS')
    hitter('LF')
    hitter('CF')
    hitter('RF')
    hitter('DH')
    pitcher('SP')
    pitcher('RP')
    pitcher('CL')
  }
  return players
}

function playerAt(
  pool: LivePlayer[],
  teamIndex: number,
  pos: LivePlayerPosition,
): LivePlayer {
  const teamId = 200 + teamIndex
  return pool.find((p) => p.teamId === teamId && p.positions[0] === pos)!
}

function fillSlot(
  state: Sim162DraftState,
  slot: Roster25Slot,
  teamIndex: number,
): Sim162DraftState {
  return assignSim162Player(state, playerAt(state.pool, teamIndex, SLOT_POSITION_KEY[slot]), slot)
}

describe('sim162-draft', () => {
  it('SIM162_TOTAL_PICKS is 25', () => {
    expect(SIM162_TOTAL_PICKS).toBe(25)
    expect(ROSTER25_POSITION_SLOTS.length).toBe(25)
  })

  it('fills all 25 slots and reaches complete status', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    expect(state.status).toBe('drafting')
    expect(state.draftedPlayerIds).toEqual([])
    expect(state.draftedTeamIds).toEqual([])

    ROSTER25_POSITION_SLOTS.forEach((slot, index) => {
      state = fillSlot(state, slot, index)
    })

    expect(state.status).toBe('complete')
    expect(isSim162RosterComplete(state)).toBe(true)
    expect(roster25IsComplete(state.roster)).toBe(true)
    expect(state.draftedPlayerIds.length).toBe(25)
    expect(state.draftedTeamIds.length).toBe(25)
    expect(new Set(state.draftedTeamIds).size).toBe(25)
    expect(roster25Players(state.roster).length).toBe(25)
    expect(state.currentSlot).toBeNull()
  })

  it('cannot draft two players from the same team (per-roster team lock)', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    state = fillSlot(state, 'C1', 0)
    expect(state.roster.C1?.teamId).toBe(200)

    const sameTeamFirstBaseman = playerAt(pool, 0, '1B')
    expect(getSim162DisabledReason(sameTeamFirstBaseman, state)).toBe('T0 used')
    const next = assignSim162Player(state, sameTeamFirstBaseman, '1B')
    expect(next.roster['1B']).toBeNull()
    expect(next.draftedPlayerIds.length).toBe(1)
  })

  it('cannot draft the same player twice (global exclusivity)', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    const catcher = playerAt(pool, 0, 'C')
    state = assignSim162Player(state, catcher, 'C1')
    expect(getSim162DisabledReason(catcher, state)).toBe('Already drafted')
    const next = assignSim162Player(state, catcher, 'BENCH1')
    expect(next.roster.BENCH1).toBeNull()
    expect(next.draftedPlayerIds.length).toBe(1)
  })

  it('rejects ineligible slot assignments', () => {
    const pool = buildSim162Pool()
    const state = createSim162DraftState(pool)
    const starter = playerAt(pool, 0, 'SP')
    const next = assignSim162Player(state, starter, 'C1')
    expect(next.roster.C1).toBeNull()
    expect(next.draftedPlayerIds.length).toBe(0)
  })

  it('getSim162DisabledReason returns the correct reason for each case', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    const catcher = playerAt(pool, 0, 'C')
    state = assignSim162Player(state, catcher, 'C1')
    expect(getSim162DisabledReason(catcher, state)).toBe('Already drafted')
    expect(getSim162DisabledReason(playerAt(pool, 0, '1B'), state)).toBe('T0 used')

    const openCatcher = playerAt(pool, 1, 'C')
    expect(getSim162DisabledReason(openCatcher, state)).toBeNull()

    const hitterSlots: Roster25Slot[] = [
      'C1',
      'C2',
      '1B',
      '2B',
      '3B',
      'SS',
      'LF',
      'CF',
      'RF',
      'DH',
      'BENCH1',
      'BENCH2',
      'BENCH3',
    ]
    hitterSlots.forEach((slot, index) => {
      if (state.roster[slot] === null) state = fillSlot(state, slot, index)
    })
    const spareHitter = playerAt(pool, 29, 'DH')
    expect(getSim162DisabledReason(spareHitter, state)).toBe('No open positions')
  })

  it('quota enforcement blocks a 3rd catcher once C/DH/bench are filled', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    state = fillSlot(state, 'C1', 0)
    state = fillSlot(state, 'C2', 1)
    state = fillSlot(state, 'DH', 2)
    state = fillSlot(state, 'BENCH1', 3)
    state = fillSlot(state, 'BENCH2', 4)
    state = fillSlot(state, 'BENCH3', 5)

    const thirdCatcher = playerAt(pool, 6, 'C')
    expect(getSim162DisabledReason(thirdCatcher, state)).toBe('No open positions')
    const next = assignSim162Player(state, thirdCatcher, '1B')
    expect(next.roster['1B']).toBeNull()
    expect(next.draftedPlayerIds.length).toBe(6)
  })

  it('autoFillSuggest proposes valid fills for every open slot', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    state = fillSlot(state, 'C1', 0)
    state = fillSlot(state, 'SP1', 1)
    const suggestions = autoFillSuggest(state)
    const open = roster25OpenSlots(state.roster)
    expect(suggestions.length).toBe(open.length)
    const usedPlayers = new Set(state.draftedPlayerIds)
    const usedTeams = new Set(state.draftedTeamIds)
    for (const suggestion of suggestions) {
      expect(open).toContain(suggestion.slot)
      expect(usedPlayers.has(suggestion.playerId)).toBe(false)
    }
    const suggestedTeamIds = suggestions.map((s) => {
      const player = pool.find((p) => p.id === s.playerId)!
      usedTeams.add(player.teamId)
      return player.teamId
    })
    expect(new Set(suggestedTeamIds).size).toBe(suggestions.length)
  })

  it('autoFillRemaining completes a partial roster without violations', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    state = fillSlot(state, 'C1', 0)
    state = fillSlot(state, 'C2', 1)
    state = fillSlot(state, '1B', 2)
    state = fillSlot(state, 'SP1', 3)
    state = fillSlot(state, 'CL', 4)
    expect(state.status).toBe('drafting')

    state = autoFillRemaining(state)
    expect(state.status).toBe('complete')
    expect(roster25IsComplete(state.roster)).toBe(true)
    expect(state.draftedPlayerIds.length).toBe(25)
    expect(new Set(state.draftedPlayerIds).size).toBe(25)
    expect(new Set(state.draftedTeamIds).size).toBe(25)
  })

  it('autoFillRemaining completes an empty roster from scratch', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    state = autoFillRemaining(state)
    expect(state.status).toBe('complete')
    expect(roster25IsComplete(state.roster)).toBe(true)
    expect(new Set(state.draftedTeamIds).size).toBe(25)
  })

  it('a pool with no catchers is stuck and cannot complete', () => {
    const pool = buildSim162Pool(30, false)
    const state = createSim162DraftState(pool)
    expect(state.status).toBe('stuck')
    expect(roster25IsComplete(state.roster)).toBe(false)

    const filled = autoFillRemaining(state)
    expect(filled.status).toBe('stuck')
    expect(roster25IsComplete(filled.roster)).toBe(false)
    expect(roster25OpenSlots(filled.roster)).toContain('C1')
    expect(roster25OpenSlots(filled.roster)).toContain('C2')
  })

  it('becomes stuck when the only catchers are on already-used teams', () => {
    const pool = buildSim162Pool()
    let state = createSim162DraftState(pool)
    state = fillSlot(state, '1B', 0)
    state = fillSlot(state, '2B', 1)

    const noCatcherPool = pool.filter((p) => !p.positions.includes('C'))
    const onlyTwoCatchers = [
      playerAt(pool, 0, 'C'),
      playerAt(pool, 1, 'C'),
    ]
    const constrainedPool = [...noCatcherPool, ...onlyTwoCatchers]
    const constrained = {
      ...state,
      pool: constrainedPool,
    }
    const filled = autoFillRemaining(constrained)
    expect(filled.status).toBe('stuck')
    expect(roster25IsComplete(filled.roster)).toBe(false)
  })
})
