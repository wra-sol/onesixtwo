import { describe, expect, it } from 'vitest'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from './live-fixtures'
import {
  createEmptyDailyLineup,
  dailyLineupOpenPositions,
  playerEligibleForDailyPosition,
  type DailyLineupPosition,
} from './daily-roster'
import {
  advanceLiveDraftTurns,
  applyUserReroll,
  canReroll,
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  draftLiveUserPlayer,
  filterRoundPool,
  isUserTurn,
  requestUserReroll,
  resolveRoundSpin,
  startLiveDraft,
} from './live-draft'
import { snakeDraftSide } from './live-draft-snake'
import { buildSimTeam, simulateBestOfThree } from './pa-sim'
import type { LiveDraftState, LivePlayer } from './live-types'

const USER_PICK_FILL_PRIORITY: DailyLineupPosition[] = [
  'SP',
  'CL',
  'RP',
  'C',
  'SS',
  '1B',
  '2B',
  '3B',
  'OF1',
  'OF2',
  'OF3',
  'DH',
]

function pickBestUserPlayer(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
): LiveDraftState {
  const open = dailyLineupOpenPositions(state.userLineup)
  const pool = filterRoundPool(players, state, 'user')
  for (const position of USER_PICK_FILL_PRIORITY) {
    if (!open.includes(position)) continue
    const player = pool.find((candidate) =>
      playerEligibleForDailyPosition(candidate, position),
    )
    if (player) {
      return draftLiveUserPlayer(state, player, players, simSeed, position)
    }
  }
  const fallback = pool[0]
  if (!fallback) return state
  return draftLiveUserPlayer(state, fallback, players, simSeed)
}

describe('live-draft', () => {
  it('snake draft alternates sides', () => {
    expect(snakeDraftSide(1, true)).toBe('user')
    expect(snakeDraftSide(2, true)).toBe('ai')
    expect(snakeDraftSide(3, true)).toBe('ai')
    expect(snakeDraftSide(4, true)).toBe('user')
  })

  it('drafts daily matchup with opponent exclusion', () => {
    const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')
    const opponent = snapshot.opponent!
    let state = createDailyMatchupDraftState(
      snapshot.challengeDate,
      snapshot.targetDate,
      opponent,
    )

    const opponentPlayer = snapshot.players.find((p) => p.teamId === opponent.teamId)
    expect(opponentPlayer).toBeUndefined()

    const first = snapshot.players[0]!
    state = draftDailyMatchupPlayer(state, first)
    expect(state.draftedTeamIds).toContain(first.teamId)
  })

  it('spins a team and picks from the same round pool', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    let state = startLiveDraft(snapshot)
    state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)

    expect(state.currentTeam).not.toBeNull()
    expect(state.roundStatus).toBe('picking')

    const pool = filterRoundPool(snapshot.players, state, 'user')
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((player) => player.teamId === state.currentTeam!.teamId)).toBe(true)
  })

  it('runs live draft user and ai picks in round order', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    let state = startLiveDraft(snapshot)
    state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)

    if (isUserTurn(state)) {
      const pick = filterRoundPool(snapshot.players, state, 'user').find(
        (p) => p.pitcherRoles?.includes('SP') && p.role === 'pitcher',
      )!
      state = draftLiveUserPlayer(
        state,
        pick,
        snapshot.players,
        snapshot.simSeed,
        'SP',
      )
      const userPick = state.picks.find((entry) => entry.side === 'user')
      expect(userPick?.roundTeamId).toBe(pick.teamId)
      expect(state.userLineup.SP?.id).toBe(pick.id)
    }
  })

  it('re-roll voids opponent pick when they went first in the round', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    let state = startLiveDraft(snapshot)
    state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)

    let guard = 0
    while (
      guard++ < 40 &&
      state.status === 'drafting' &&
      !(isUserTurn(state) && state.roundPickIds.length === 1)
    ) {
      if (!isUserTurn(state)) {
        state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
        continue
      }
      const pick = filterRoundPool(snapshot.players, state, 'user')[0]
      if (!pick) break
      state = pickBestUserPlayer(state, snapshot.players, snapshot.simSeed)
      state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
    }

    if (!(isUserTurn(state) && state.roundPickIds.length === 1)) {
      return
    }

    const beforeTeam = state.currentTeam!.teamId
    const opponentPickInRound = state.picks.find(
      (pick) => pick.side === 'ai' && pick.round === state.round,
    )
    expect(opponentPickInRound).toBeDefined()

    expect(canReroll('user', state)).toBe(true)
    state = requestUserReroll(state)
    state = applyUserReroll(state, snapshot.players, snapshot.simSeed)

    expect(state.userRerollUsed).toBe(true)
    expect(
      state.picks.some(
        (pick) =>
          pick.side === 'ai' &&
          pick.playerId === opponentPickInRound!.playerId &&
          pick.round === state.round,
      ),
    ).toBe(false)
    expect(state.currentTeam?.teamId).not.toBe(beforeTeam)
  })

  it('does not spin a team with only one catcher when both sides still need C', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-30')
    let state = startLiveDraft(snapshot)
    state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)

    let guard = 0
    while (state.status === 'drafting' && state.round < 12 && guard++ < 80) {
      if (state.roundStatus === 'spinning') {
        state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
        continue
      }
      if (!isUserTurn(state)) {
        state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
        continue
      }
      const pool = filterRoundPool(snapshot.players, state, 'user')
      const pick =
        pool
          .filter((player) => !player.positions.includes('C'))
          .sort((a, b) => b.grades.overall - a.grades.overall)[0] ??
        pool.sort((a, b) => b.grades.overall - a.grades.overall)[0]
      if (!pick) break
      state = draftLiveUserPlayer(state, pick, snapshot.players, snapshot.simSeed)
      state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
    }

    expect(state.round).toBe(12)
    state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
    expect(state.currentTeam).not.toBeNull()
    expect(filterRoundPool(snapshot.players, state, 'user').length).toBeGreaterThan(0)
  })

  it('completes a full 12-round draft', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    let state = startLiveDraft(snapshot)
    state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)

    let guard = 0
    while (state.status === 'drafting' && guard++ < 80) {
      if (state.roundStatus === 'spinning') {
        state = resolveRoundSpin(state, snapshot.players, snapshot.simSeed)
        state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
        continue
      }
      if (!isUserTurn(state)) {
        state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
        continue
      }
      const pick = filterRoundPool(snapshot.players, state, 'user')[0]
      if (!pick) break
      state = pickBestUserPlayer(state, snapshot.players, snapshot.simSeed)
      state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
    }

    expect(state.status).toBe('lineup')
    expect(state.roundTeams).toHaveLength(12)
  })
})

describe('pa-sim', () => {
  it('simulates deterministic best-of-3', () => {
    const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')
    const opponent = snapshot.opponent!
    const lineup = createEmptyDailyLineup()
    const hitters = snapshot.players.filter((p) => p.role === 'hitter').slice(0, 9)
    const pitchers = snapshot.players.filter((p) => p.role === 'pitcher').slice(0, 3)

    lineup.C = hitters[0] ?? null
    lineup['1B'] = hitters[1] ?? null
    lineup['2B'] = hitters[2] ?? null
    lineup['3B'] = hitters[3] ?? null
    lineup.SS = hitters[4] ?? null
    lineup.OF1 = hitters[5] ?? null
    lineup.OF2 = hitters[6] ?? null
    lineup.OF3 = hitters[7] ?? null
    lineup.DH = hitters[8] ?? null
    lineup.SP = pitchers[0] ?? null
    lineup.RP = pitchers[1] ?? null
    lineup.CL = pitchers[2] ?? null

    const opponentLineup = createEmptyDailyLineup()
    for (const [pos, player] of Object.entries(opponent.lineup)) {
      if (player) opponentLineup[pos as keyof typeof opponentLineup] = player
    }

    const userTeam = buildSimTeam('You', lineup, hitters, true)
    const opponentTeam = buildSimTeam(
      opponent.teamName,
      opponentLineup,
      opponent.battingOrder,
      false,
    )

    const a = simulateBestOfThree(userTeam, opponentTeam, snapshot.simSeed)
    const b = simulateBestOfThree(userTeam, opponentTeam, snapshot.simSeed)
    expect(a.userWins).toBe(b.userWins)
    expect(a.opponentWins).toBe(b.opponentWins)
    expect(a.games.length).toBeGreaterThan(0)
  })
})
