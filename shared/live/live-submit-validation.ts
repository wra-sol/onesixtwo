import {
  createEmptyDailyLineup,
  DAILY_HITTER_POSITIONS,
  DAILY_LINEUP_POSITIONS,
  playerEligibleForDailyPosition,
  type DailyLineup,
} from './daily-roster'
import { validateLiveDraftRoundTeams } from './live-draft'
import type {
  DailyMatchupSnapshot,
  LiveDraftSnapshot,
  LivePlayer,
  LiveSubmitPayload,
} from './live-types'

export type LiveSubmitValidationError = { ok: false; error: string }

export type ValidatedDailyMatchupSubmission = {
  ok: true
  userLineup: DailyLineup
  battingOrder: LivePlayer[]
}

export type ValidatedLiveDraftSubmission = {
  ok: true
  userLineup: DailyLineup
  aiLineup: DailyLineup
  battingOrder: LivePlayer[]
}

export function lineupFromPlayerIds(
  playersById: Map<string, LivePlayer>,
  playerIds: readonly string[],
): DailyLineup {
  const lineup = createEmptyDailyLineup()
  playerIds.forEach((id, index) => {
    const player = playersById.get(id)
    const position = DAILY_LINEUP_POSITIONS[index]
    if (player && position) {
      lineup[position] = player
    }
  })
  return lineup
}

function assertExactIdList(
  ids: readonly string[],
  expectedLength: number,
  label: string,
): LiveSubmitValidationError | null {
  if (ids.length !== expectedLength) {
    return { ok: false, error: `${label} must include ${expectedLength} players.` }
  }
  if (ids.some((id) => !id.trim())) {
    return { ok: false, error: `${label} includes empty player slots.` }
  }
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    return { ok: false, error: `${label} includes duplicate players.` }
  }
  return null
}

function validateLineupPlayerIds(
  playersById: Map<string, LivePlayer>,
  playerIds: readonly string[],
  label: string,
  options?: { forbiddenTeamId?: number },
): LiveSubmitValidationError | { ok: true; lineup: DailyLineup } {
  const lengthError = assertExactIdList(playerIds, 12, label)
  if (lengthError) return lengthError

  const lineup = lineupFromPlayerIds(playersById, playerIds)
  const teamIds = new Set<number>()

  for (const position of DAILY_LINEUP_POSITIONS) {
    const player = lineup[position]
    if (!player) {
      return { ok: false, error: `${label} is missing a player for ${position}.` }
    }
    if (!playersById.has(player.id)) {
      return { ok: false, error: `${label} includes players outside today's pool.` }
    }
    if (options?.forbiddenTeamId !== undefined && player.teamId === options.forbiddenTeamId) {
      return { ok: false, error: `${label} includes opponent-team players.` }
    }
    if (teamIds.has(player.teamId)) {
      return { ok: false, error: `${label} uses the same MLB team more than once.` }
    }
    teamIds.add(player.teamId)
    if (!playerEligibleForDailyPosition(player, position)) {
      return {
        ok: false,
        error: `${player.name} is not eligible at ${position} in ${label}.`,
      }
    }
  }

  return { ok: true, lineup }
}

function validateBattingOrderIds(
  playersById: Map<string, LivePlayer>,
  battingOrderIds: readonly string[],
  lineup: DailyLineup,
): LiveSubmitValidationError | { ok: true; battingOrder: LivePlayer[] } {
  if (battingOrderIds.length !== DAILY_HITTER_POSITIONS.length) {
    return {
      ok: false,
      error: `Batting order must include ${DAILY_HITTER_POSITIONS.length} hitters.`,
    }
  }
  if (new Set(battingOrderIds).size !== battingOrderIds.length) {
    return { ok: false, error: 'Batting order includes duplicate hitters.' }
  }

  const lineupHitters = new Set(
    DAILY_HITTER_POSITIONS.map((pos) => lineup[pos]?.id).filter(Boolean),
  )

  const battingOrder: LivePlayer[] = []
  for (const id of battingOrderIds) {
    const player = playersById.get(id)
    if (!player) {
      return { ok: false, error: 'Batting order includes players outside today\'s pool.' }
    }
    if (player.role !== 'hitter') {
      return { ok: false, error: 'Batting order must include hitters only.' }
    }
    if (!lineupHitters.has(id)) {
      return { ok: false, error: 'Batting order must match your drafted hitters.' }
    }
    battingOrder.push(player)
  }

  return { ok: true, battingOrder }
}

export function validateDailyMatchupSubmission(
  snapshot: DailyMatchupSnapshot,
  payload: Pick<LiveSubmitPayload, 'challengeDate' | 'targetDate' | 'playerIds' | 'battingOrderIds'>,
): LiveSubmitValidationError | ValidatedDailyMatchupSubmission {
  if (!snapshot.available || !snapshot.opponent) {
    return { ok: false, error: 'Daily Matchup is unavailable today.' }
  }
  if (payload.challengeDate !== snapshot.challengeDate) {
    return { ok: false, error: 'Submission challenge date does not match today.' }
  }
  if (payload.targetDate !== snapshot.targetDate) {
    return { ok: false, error: 'Submission target date does not match today.' }
  }

  const playersById = new Map(snapshot.players.map((player) => [player.id, player]))
  const lineupResult = validateLineupPlayerIds(
    playersById,
    payload.playerIds,
    'Lineup',
    { forbiddenTeamId: snapshot.opponent.teamId },
  )
  if (!lineupResult.ok) return lineupResult

  const battingResult = validateBattingOrderIds(
    playersById,
    payload.battingOrderIds,
    lineupResult.lineup,
  )
  if (!battingResult.ok) return battingResult

  return {
    ok: true,
    userLineup: lineupResult.lineup,
    battingOrder: battingResult.battingOrder,
  }
}

export function validateLiveDraftSubmission(
  snapshot: LiveDraftSnapshot,
  payload: Pick<
    LiveSubmitPayload,
    'challengeDate' | 'playerIds' | 'battingOrderIds' | 'aiPlayerIds'
  >,
): LiveSubmitValidationError | ValidatedLiveDraftSubmission {
  if (payload.challengeDate !== snapshot.challengeDate) {
    return { ok: false, error: 'Submission challenge date does not match today.' }
  }
  if (!payload.aiPlayerIds) {
    return { ok: false, error: 'Live Draft requires aiPlayerIds.' }
  }

  const playersById = new Map(snapshot.players.map((player) => [player.id, player]))
  const userResult = validateLineupPlayerIds(playersById, payload.playerIds, 'Your lineup')
  if (!userResult.ok) return userResult

  const aiResult = validateLineupPlayerIds(playersById, payload.aiPlayerIds, 'AI lineup')
  if (!aiResult.ok) return aiResult

  const userIds = new Set(payload.playerIds)
  for (const id of payload.aiPlayerIds) {
    if (userIds.has(id)) {
      return { ok: false, error: 'User and AI lineups share a player.' }
    }
  }

  const battingResult = validateBattingOrderIds(
    playersById,
    payload.battingOrderIds,
    userResult.lineup,
  )
  if (!battingResult.ok) return battingResult

  const roundTeamError = validateLiveDraftRoundTeams(userResult.lineup, aiResult.lineup)
  if (roundTeamError) {
    return { ok: false, error: roundTeamError }
  }

  return {
    ok: true,
    userLineup: userResult.lineup,
    aiLineup: aiResult.lineup,
    battingOrder: battingResult.battingOrder,
  }
}

