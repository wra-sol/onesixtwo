import { describe, expect, it } from 'vitest'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from './live-fixtures'
import {
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  draftLiveUserPlayer,
  advanceLiveDraftTurns,
  filterRoundPool,
  getDailyMatchupDisabledReason,
  isUserTurn,
  startLiveDraft,
} from './live-draft'
import { lineupPlayerIdsFromDailyLineup } from './live-lineup-ids'
import {
  DAILY_HITTER_POSITIONS,
  dailyLineupOpenPositions,
  playerEligibleForDailyPosition,
  type DailyLineupPosition,
} from './daily-roster'
import {
  validateDailyMatchupSubmission,
  validateLiveDraftSubmission,
} from './live-submit-validation'
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

function buildLegalLiveDraftPayload() {
  const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
  let state = startLiveDraft(snapshot)
  state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)

  let guard = 0
  while (state.status === 'drafting' && guard++ < 100) {
    if (state.roundStatus === 'spinning') {
      state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
      continue
    }
    if (!isUserTurn(state)) {
      state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
      continue
    }
    if (!filterRoundPool(snapshot.players, state, 'user')[0]) break
    state = pickBestUserPlayer(state, snapshot.players, snapshot.simSeed)
    state = advanceLiveDraftTurns(state, snapshot.players, snapshot.simSeed)
  }

  expect(state.status).toBe('lineup')

  return {
    snapshot,
    userIds: lineupPlayerIdsFromDailyLineup(state.userLineup),
    aiIds: lineupPlayerIdsFromDailyLineup(state.aiLineup),
    battingOrderIds: state.userBattingOrder.map((player) => player.id),
  }
}

function buildLegalDailyMatchupPayload() {
  const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')
  let state = createDailyMatchupDraftState(
    snapshot.challengeDate,
    snapshot.targetDate,
    snapshot.opponent!,
  )

  for (const player of [...snapshot.players].sort((a, b) => b.grades.overall - a.grades.overall)) {
    if (state.status !== 'drafting') break
    if (getDailyMatchupDisabledReason(player, state)) continue
    state = draftDailyMatchupPlayer(state, player)
  }

  return {
    snapshot,
    payload: {
      challengeDate: snapshot.challengeDate,
      targetDate: snapshot.targetDate,
      playerIds: lineupPlayerIdsFromDailyLineup(state.lineup),
      battingOrderIds: state.battingOrder.map((player) => player.id),
    },
  }
}

describe('validateDailyMatchupSubmission', () => {
  it('accepts a legal daily matchup lineup', () => {
    const { snapshot, payload } = buildLegalDailyMatchupPayload()
    const result = validateDailyMatchupSubmission(snapshot, payload)
    expect(result.ok).toBe(true)
  })

  it('rejects duplicate-team forged lineups', () => {
    const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')
    const sameTeam = snapshot.players.filter((p) => p.teamId !== snapshot.opponent!.teamId)
    const playerIds = sameTeam.slice(0, 12).map((p) => p.id)

    const result = validateDailyMatchupSubmission(snapshot, {
      challengeDate: snapshot.challengeDate,
      targetDate: snapshot.targetDate,
      playerIds,
      battingOrderIds: playerIds.slice(0, 9),
    })

    expect(result).toEqual({
      ok: false,
      error: 'Lineup uses the same MLB team more than once.',
    })
  })

  it('rejects batting order with players not in lineup', () => {
    const { snapshot, payload } = buildLegalDailyMatchupPayload()
    const pitcherId = payload.playerIds[9]!

    const result = validateDailyMatchupSubmission(snapshot, {
      ...payload,
      battingOrderIds: [pitcherId, ...payload.battingOrderIds.slice(1)],
    })

    expect(result).toEqual({
      ok: false,
      error: 'Batting order must include hitters only.',
    })
  })

  it('rejects opponent-team players', () => {
    const { snapshot, payload } = buildLegalDailyMatchupPayload()
    const smuggled = {
      ...snapshot.players[0]!,
      id: 'smuggled-opponent-team',
      teamId: snapshot.opponent!.teamId,
      teamAbbrev: snapshot.opponent!.teamAbbrev,
    }
    const snapshotWithSmuggled = {
      ...snapshot,
      players: [...snapshot.players, smuggled],
    }

    const forgedIds = [...payload.playerIds]
    forgedIds[0] = smuggled.id

    const result = validateDailyMatchupSubmission(snapshotWithSmuggled, {
      ...payload,
      playerIds: forgedIds,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Lineup includes opponent-team players.',
    })
  })
})

describe('validateLiveDraftSubmission', () => {
  it('accepts a legal live draft submission', () => {
    const { snapshot, userIds, aiIds, battingOrderIds } = buildLegalLiveDraftPayload()
    const result = validateLiveDraftSubmission(snapshot, {
      challengeDate: snapshot.challengeDate,
      playerIds: userIds,
      aiPlayerIds: aiIds,
      battingOrderIds,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects overlapping user and AI players', () => {
    const { snapshot, userIds, battingOrderIds } = buildLegalLiveDraftPayload()

    const result = validateLiveDraftSubmission(snapshot, {
      challengeDate: snapshot.challengeDate,
      playerIds: userIds,
      aiPlayerIds: userIds,
      battingOrderIds,
    })

    expect(result).toEqual({
      ok: false,
      error: 'User and AI lineups share a player.',
    })
  })

  it('rejects duplicate teams within a lineup', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    const sameTeam = snapshot.players.filter((p) => p.teamAbbrev === 'LAD')
    const playerIds = sameTeam.slice(0, 12).map((p) => p.id)

    const result = validateLiveDraftSubmission(snapshot, {
      challengeDate: snapshot.challengeDate,
      playerIds,
      aiPlayerIds: snapshot.players.slice(12, 24).map((p) => p.id),
      battingOrderIds: playerIds.slice(0, DAILY_HITTER_POSITIONS.length),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('same MLB team')
    }
  })
})
