import { describe, expect, it } from 'vitest'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from './live-fixtures'
import { createEmptyDailyLineup } from './daily-roster'
import {
  createDailyMatchupDraftState,
  createLiveDraftState,
  draftDailyMatchupPlayer,
  draftLiveUserPlayer,
  isUserTurn,
  snakeDraftSide,
} from './live-draft'
import { buildSimTeam, simulateBestOfThree } from './pa-sim'

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

  it('runs live draft user and ai picks', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    let state = createLiveDraftState(snapshot)
    expect(isUserTurn(state)).toBe(snapshot.coinFlipUserFirst)

    if (isUserTurn(state)) {
      const pick = snapshot.players.find(
        (p) => p.pitcherRoles?.includes('SP') && p.role === 'pitcher',
      )!
      state = draftLiveUserPlayer(
        state,
        pick,
        snapshot.players,
        snapshot.simSeed,
        'SP',
      )
      expect(state.userLineup.SP?.id).toBe(pick.id)
    }
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