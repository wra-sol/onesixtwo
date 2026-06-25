import { createSeededRandomFromString } from './rng'
import {
  createEmptyDailyLineup,
  dailyLineupIsComplete,
  dailyLineupOpenPositions,
  dailyLineupPlayers,
  defaultBattingOrderFromLineup,
  playerEligibleForDailyPosition,
  type DailyLineup,
  type DailyLineupPosition,
} from './daily-roster'
import type {
  DailyMatchupDraftState,
  LiveDraftPick,
  LiveDraftRoundTeam,
  LiveDraftState,
  LiveDraftSnapshot,
  LivePlayer,
  OpponentRoster,
} from './live-types'

export const LIVE_DRAFT_TOTAL_ROUNDS = 12
const TOTAL_PICKS = LIVE_DRAFT_TOTAL_ROUNDS * 2
const AI_REROLL_SCORE_THRESHOLD = 62

export function snakeDraftSide(
  pickNumber: number,
  userPicksFirst: boolean,
): 'user' | 'ai' {
  const round = Math.floor((pickNumber - 1) / 2)
  const isFirstInRound = (pickNumber - 1) % 2 === 0
  const userFirstThisRound = round % 2 === 0 ? userPicksFirst : !userPicksFirst
  if (isFirstInRound) {
    return userFirstThisRound ? 'user' : 'ai'
  }
  return userFirstThisRound ? 'ai' : 'user'
}

export function startLiveDraft(snapshot: LiveDraftSnapshot): LiveDraftState {
  return {
    mode: 'live-draft',
    challengeDate: snapshot.challengeDate,
    coinFlipUserFirst: snapshot.coinFlipUserFirst,
    currentPick: 1,
    userLineup: createEmptyDailyLineup(),
    aiLineup: createEmptyDailyLineup(),
    userBattingOrder: [],
    aiBattingOrder: [],
    draftedPlayerIds: [],
    picks: [],
    status: 'drafting',
    userPicksFirst: snapshot.coinFlipUserFirst,
    roundStatus: 'spinning',
    round: 1,
    currentTeam: null,
    roundPickIds: [],
    userRerollUsed: false,
    aiRerollUsed: false,
    usedRoundTeamIds: [],
    roundTeams: [],
    pendingRerollSide: null,
  }
}

/** @deprecated Use startLiveDraft — kept for tests. */
export function createLiveDraftState(snapshot: LiveDraftSnapshot): LiveDraftState {
  return startLiveDraft(snapshot)
}

export function createDailyMatchupDraftState(
  challengeDate: string,
  targetDate: string,
  opponent: OpponentRoster,
): DailyMatchupDraftState {
  return {
    mode: 'daily-matchup',
    challengeDate,
    targetDate,
    opponent,
    lineup: createEmptyDailyLineup(),
    battingOrder: [],
    draftedPlayerIds: [],
    draftedTeamIds: [],
    status: 'drafting',
  }
}

function bestOpenPosition(
  player: LivePlayer,
  lineup: DailyLineup,
): DailyLineupPosition | null {
  const open = dailyLineupOpenPositions(lineup)
  const eligible = open.filter((pos) => playerEligibleForDailyPosition(player, pos))
  if (eligible.length === 0) return null

  const priority: DailyLineupPosition[] = [
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
  for (const pos of priority) {
    if (eligible.includes(pos)) return pos
  }
  return eligible[0] ?? null
}

function sideLineup(state: LiveDraftState, side: 'user' | 'ai'): DailyLineup {
  return side === 'user' ? state.userLineup : state.aiLineup
}

function roundStartPick(round: number): number {
  return (round - 1) * 2 + 1
}

function pickNumberForSideInRound(
  round: number,
  side: 'user' | 'ai',
  userPicksFirst: boolean,
): number {
  const startPick = roundStartPick(round)
  const userFirstThisRound = snakeDraftSide(startPick, userPicksFirst) === 'user'
  if (side === 'user') {
    return userFirstThisRound ? startPick : startPick + 1
  }
  return userFirstThisRound ? startPick + 1 : startPick
}

function spinSeed(state: LiveDraftState, simSeed: string): string {
  return `${simSeed}|round${state.round}|used${state.usedRoundTeamIds.join('.')}|reroll${state.pendingRerollSide ?? 'none'}|picks${state.roundPickIds.length}`
}

function teamHasEnoughPickable(
  players: LivePlayer[],
  state: LiveDraftState,
  teamId: number,
  picksNeeded: number,
): boolean {
  const pool = players.filter(
    (player) => player.teamId === teamId && !state.draftedPlayerIds.includes(player.id),
  )
  if (pool.length < picksNeeded) return false

  if (picksNeeded === 1) {
    const side = snakeDraftSide(state.currentPick, state.userPicksFirst)
    const lineup = sideLineup(state, side)
    if (dailyLineupIsComplete(lineup)) return true
    return pool.some((player) => bestOpenPosition(player, lineup) !== null)
  }

  const userComplete = dailyLineupIsComplete(state.userLineup)
  const aiComplete = dailyLineupIsComplete(state.aiLineup)
  if (userComplete && !aiComplete) {
    return pool.some((player) => bestOpenPosition(player, state.aiLineup) !== null)
  }
  if (aiComplete && !userComplete) {
    return pool.some((player) => bestOpenPosition(player, state.userLineup) !== null)
  }

  const userOk = pool.some(
    (player) => bestOpenPosition(player, state.userLineup) !== null,
  )
  const aiOk = pool.some((player) => bestOpenPosition(player, state.aiLineup) !== null)
  return userOk && aiOk && pool.length >= 2
}

export function getSpinEligibleTeams(
  players: LivePlayer[],
  state: LiveDraftState,
  excludeTeamIds: number[] = [],
): LiveDraftRoundTeam[] {
  const excluded = new Set([...state.usedRoundTeamIds, ...excludeTeamIds])
  const teams = new Map<number, LiveDraftRoundTeam>()

  for (const player of players) {
    if (!teams.has(player.teamId)) {
      teams.set(player.teamId, {
        teamId: player.teamId,
        teamAbbrev: player.teamAbbrev,
        teamName: player.teamName,
      })
    }
  }

  const picksNeeded = 2 - state.roundPickIds.length

  return [...teams.values()].filter((team) => {
    if (excluded.has(team.teamId)) return false
    return teamHasEnoughPickable(players, state, team.teamId, picksNeeded)
  })
}

function spinRoundTeam(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
  excludeTeamIds: number[] = [],
): LiveDraftRoundTeam | null {
  const eligible = getSpinEligibleTeams(players, state, excludeTeamIds)
  if (eligible.length === 0) return null

  const random = createSeededRandomFromString(spinSeed(state, simSeed))
  const index = Math.floor(random() * eligible.length)
  return eligible[index] ?? null
}

export function resolveRoundSpin(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
): LiveDraftState {
  if (state.status !== 'drafting' || state.roundStatus !== 'spinning') {
    return state
  }

  const exclude =
    state.pendingRerollSide && state.currentTeam ? [state.currentTeam.teamId] : []
  const team = spinRoundTeam(state, players, simSeed, exclude)
  if (!team) {
    return { ...state, status: 'stuck', pendingRerollSide: null }
  }

  return {
    ...state,
    currentTeam: team,
    roundStatus: 'picking',
    pendingRerollSide: null,
  }
}

export function filterRoundPool(
  players: LivePlayer[],
  state: LiveDraftState,
  side: 'user' | 'ai',
): LivePlayer[] {
  if (state.status !== 'drafting' || state.roundStatus !== 'picking' || !state.currentTeam) {
    return []
  }

  const lineup = sideLineup(state, side)
  return players.filter(
    (player) =>
      player.teamId === state.currentTeam!.teamId &&
      !state.draftedPlayerIds.includes(player.id) &&
      bestOpenPosition(player, lineup) !== null,
  )
}

export function getDailyMatchupDisabledReason(
  player: LivePlayer,
  state: DailyMatchupDraftState,
): string | null {
  if (state.draftedPlayerIds.includes(player.id)) return 'Already drafted'
  if (state.draftedTeamIds.includes(player.teamId)) return `${player.teamAbbrev} used`
  if (player.teamId === state.opponent.teamId) return 'Opponent team'
  const position = bestOpenPosition(player, state.lineup)
  if (!position) return 'No open positions'
  if (!playerEligibleForDailyPosition(player, position)) return 'No eligible slot'
  return null
}

export function getLiveDraftUserDisabledReason(
  player: LivePlayer,
  state: LiveDraftState,
  players: LivePlayer[],
): string | null {
  if (state.status !== 'drafting') return 'Draft complete'
  if (state.roundStatus !== 'picking') return 'Wait for team spin'
  if (!isUserTurn(state)) return 'Wait for your pick'
  if (!state.currentTeam) return 'No team selected'
  if (player.teamId !== state.currentTeam.teamId) {
    return `Pick from ${state.currentTeam.teamAbbrev} only`
  }
  if (state.draftedPlayerIds.includes(player.id)) return 'Already drafted'
  if (!filterRoundPool(players, state, 'user').some((entry) => entry.id === player.id)) {
    return 'No eligible slot'
  }
  const position = bestOpenPosition(player, state.userLineup)
  if (!position) return 'No open positions'
  if (!playerEligibleForDailyPosition(player, position)) return 'No eligible slot'
  return null
}

export function draftDailyMatchupPlayer(
  state: DailyMatchupDraftState,
  player: LivePlayer,
  position?: DailyLineupPosition,
): DailyMatchupDraftState {
  if (getDailyMatchupDisabledReason(player, state)) {
    return state
  }
  const slot = position ?? bestOpenPosition(player, state.lineup)
  if (!slot || !playerEligibleForDailyPosition(player, slot)) {
    return state
  }

  const next: DailyMatchupDraftState = {
    ...state,
    lineup: { ...state.lineup, [slot]: player },
    draftedPlayerIds: [...state.draftedPlayerIds, player.id],
    draftedTeamIds: [...state.draftedTeamIds, player.teamId],
  }

  if (dailyLineupIsComplete(next.lineup)) {
    return {
      ...next,
      status: 'lineup',
      battingOrder: defaultBattingOrderFromLineup(next.lineup),
    }
  }
  return next
}

function scorePlayerForAi(player: LivePlayer, lineup: DailyLineup): number {
  const position = bestOpenPosition(player, lineup)
  if (!position) return -1
  let score = player.grades.overall
  if (position === 'SP' || position === 'CL') score += 5
  if (position === 'RP') score += 2
  return score
}

function aiPickFromRoundPool(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
): LivePlayer | null {
  const random = createSeededRandomFromString(`${simSeed}|pick${state.currentPick}`)
  const available = filterRoundPool(players, state, 'ai')
  if (available.length === 0) return null

  const scored = available
    .map((player) => ({ player, score: scorePlayerForAi(player, state.aiLineup) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null

  const top = scored.slice(0, Math.min(5, scored.length))
  const blockChance = 0.15
  if (random() < blockChance && top.length > 1) {
    return top[1]!.player
  }
  const index = Math.floor(random() * Math.min(3, top.length))
  return top[index]!.player
}

function applySidePick(
  state: LiveDraftState,
  player: LivePlayer,
  side: 'user' | 'ai',
  pickNumber: number,
  position: DailyLineupPosition,
): LiveDraftState {
  if (!state.currentTeam) return state

  const pick: LiveDraftPick = {
    pickNumber,
    side,
    playerId: player.id,
    position,
    round: state.round,
    roundTeamId: state.currentTeam.teamId,
  }

  const lineupKey = side === 'user' ? 'userLineup' : 'aiLineup'

  return {
    ...state,
    [lineupKey]: { ...state[lineupKey], [position]: player },
    draftedPlayerIds: [...state.draftedPlayerIds, player.id],
    picks: [...state.picks, pick],
    roundPickIds: [...state.roundPickIds, player.id],
    currentPick: pickNumber + 1,
  }
}

function voidOpponentRoundPick(
  state: LiveDraftState,
  rerollingSide: 'user' | 'ai',
): LiveDraftState {
  if (state.roundPickIds.length === 0) return state

  const startPick = roundStartPick(state.round)
  const roundPicks = state.picks.filter(
    (pick) => pick.pickNumber >= startPick && pick.pickNumber < startPick + 2,
  )
  const opponentPick = roundPicks.find((pick) => pick.side !== rerollingSide)
  if (!opponentPick) return state

  const lineupKey = opponentPick.side === 'user' ? 'userLineup' : 'aiLineup'
  const lineup = { ...state[lineupKey], [opponentPick.position]: null }

  return {
    ...state,
    [lineupKey]: lineup,
    draftedPlayerIds: state.draftedPlayerIds.filter((id) => id !== opponentPick.playerId),
    picks: state.picks.filter((pick) => pick.pickNumber !== opponentPick.pickNumber),
    roundPickIds: state.roundPickIds.filter((id) => id !== opponentPick.playerId),
    currentPick:
      rerollingSide === 'user'
        ? state.currentPick
        : pickNumberForSideInRound(state.round, 'user', state.userPicksFirst),
  }
}

function finalizeLineupPhase(state: LiveDraftState): LiveDraftState {
  return {
    ...state,
    status: 'lineup',
    roundStatus: 'picking',
    currentTeam: null,
    userBattingOrder: defaultBattingOrderFromLineup(state.userLineup),
    aiBattingOrder: defaultBattingOrderFromLineup(state.aiLineup),
  }
}

function beginNextRound(state: LiveDraftState): LiveDraftState {
  const team = state.currentTeam
  if (!team) return state

  const next: LiveDraftState = {
    ...state,
    roundTeams: [...state.roundTeams, team],
    usedRoundTeamIds: [...state.usedRoundTeamIds, team.teamId],
    roundPickIds: [],
    currentTeam: null,
    round: state.round + 1,
    roundStatus: 'spinning',
  }

  if (state.round >= LIVE_DRAFT_TOTAL_ROUNDS) {
    if (
      dailyLineupIsComplete(next.userLineup) &&
      dailyLineupIsComplete(next.aiLineup)
    ) {
      return finalizeLineupPhase(next)
    }
    return { ...next, status: 'stuck' }
  }

  return next
}

function afterPickAdvance(
  state: LiveDraftState,
): LiveDraftState {
  const roundEndPick = roundStartPick(state.round) + 1
  if (state.currentPick <= roundEndPick) {
    return state
  }

  return beginNextRound(state)
}

export function canReroll(side: 'user' | 'ai', state: LiveDraftState): boolean {
  if (state.status !== 'drafting' || state.roundStatus !== 'picking') return false
  if (side === 'user' && state.userRerollUsed) return false
  if (side === 'ai' && state.aiRerollUsed) return false
  if (side === 'user' && !isUserTurn(state)) return false
  return true
}

function maybeAiReroll(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
): LiveDraftState {
  if (!canReroll('ai', state) || state.roundPickIds.length === 0) {
    return state
  }

  const pool = filterRoundPool(players, state, 'ai')
  const bestScore = pool.reduce((max, player) => {
    return Math.max(max, scorePlayerForAi(player, state.aiLineup))
  }, -1)

  if (bestScore >= AI_REROLL_SCORE_THRESHOLD && pool.length > 0) {
    return state
  }

  let next: LiveDraftState = {
    ...state,
    aiRerollUsed: true,
    roundStatus: 'spinning',
    pendingRerollSide: 'ai',
  }
  next = voidOpponentRoundPick(next, 'ai')
  next = resolveRoundSpin(next, players, simSeed)
  if (next.status === 'stuck') return next
  return next
}

export function requestUserReroll(state: LiveDraftState): LiveDraftState {
  if (!canReroll('user', state)) return state
  return {
    ...state,
    roundStatus: 'spinning',
    pendingRerollSide: 'user',
  }
}

export function applyUserReroll(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
): LiveDraftState {
  if (state.pendingRerollSide !== 'user' || state.roundStatus !== 'spinning') {
    return state
  }

  let next: LiveDraftState = { ...state, userRerollUsed: true }
  next = voidOpponentRoundPick(next, 'user')
  next = resolveRoundSpin(next, players, simSeed)
  if (next.status === 'stuck') return next
  return advanceLiveDraftTurns(next, players, simSeed)
}

export function advanceLiveDraftTurns(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
): LiveDraftState {
  let next = state

  if (next.status !== 'drafting') {
    return next
  }

  if (next.roundStatus === 'spinning') {
    next = resolveRoundSpin(next, players, simSeed)
    if (next.status !== 'drafting') {
      return next
    }
  }

  while (next.status === 'drafting' && next.roundStatus === 'picking') {
    const side = snakeDraftSide(next.currentPick, next.userPicksFirst)

    if (side === 'user' && dailyLineupIsComplete(next.userLineup)) {
      next = { ...next, currentPick: next.currentPick + 1 }
      next = afterPickAdvance(next)
      if (next.status !== 'drafting' || next.roundStatus === 'spinning') {
        break
      }
      continue
    }

    if (side === 'ai' && dailyLineupIsComplete(next.aiLineup)) {
      next = { ...next, currentPick: next.currentPick + 1 }
      next = afterPickAdvance(next)
      if (next.status !== 'drafting' || next.roundStatus === 'spinning') {
        break
      }
      continue
    }

    if (side !== 'ai') {
      break
    }

    next = maybeAiReroll(next, players, simSeed)
    if (next.status !== 'drafting' || next.roundStatus === 'spinning') {
      next = advanceLiveDraftTurns(next, players, simSeed)
      break
    }
    if (snakeDraftSide(next.currentPick, next.userPicksFirst) !== 'ai') {
      break
    }

    const aiPlayer = aiPickFromRoundPool(next, players, simSeed)
    if (!aiPlayer) {
      return { ...next, status: 'stuck' }
    }

    const position = bestOpenPosition(aiPlayer, next.aiLineup)
    if (!position) {
      return { ...next, status: 'stuck' }
    }

    next = applySidePick(next, aiPlayer, 'ai', next.currentPick, position)
    next = afterPickAdvance(next)
    if (next.status !== 'drafting' || next.roundStatus === 'spinning') {
      break
    }
  }

  return next
}

export function draftLiveUserPlayer(
  state: LiveDraftState,
  player: LivePlayer,
  players: LivePlayer[],
  _simSeed: string,
  position?: DailyLineupPosition,
): LiveDraftState {
  if (getLiveDraftUserDisabledReason(player, state, players)) return state
  const slot = position ?? bestOpenPosition(player, state.userLineup)
  if (!slot) return state

  let next = applySidePick(state, player, 'user', state.currentPick, slot)
  next = afterPickAdvance(next)
  return next
}

/** @deprecated Use advanceLiveDraftTurns. */
export function advanceLiveDraftAfterPick(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed?: string,
): LiveDraftState {
  return advanceLiveDraftTurns(state, players, simSeed ?? state.challengeDate)
}

export function isUserTurn(state: LiveDraftState): boolean {
  if (state.status !== 'drafting') return false
  if (state.roundStatus !== 'picking') return false
  if (state.currentPick > TOTAL_PICKS) return false
  if (dailyLineupIsComplete(state.userLineup)) return false
  return snakeDraftSide(state.currentPick, state.userPicksFirst) === 'user'
}

export function validateLiveDraftRoundTeams(
  userLineup: DailyLineup,
  aiLineup: DailyLineup,
): string | null {
  const userPlayers = dailyLineupPlayers(userLineup)
  const aiPlayers = dailyLineupPlayers(aiLineup)
  const userTeams = userPlayers.map((player) => player.teamId)
  const aiTeams = aiPlayers.map((player) => player.teamId)

  if (new Set(userTeams).size !== userTeams.length) {
    return 'Your lineup uses the same MLB team more than once.'
  }
  if (new Set(aiTeams).size !== aiTeams.length) {
    return 'AI lineup uses the same MLB team more than once.'
  }

  const userTeamSet = new Set(userTeams)
  const aiTeamSet = new Set(aiTeams)
  if (userTeamSet.size !== LIVE_DRAFT_TOTAL_ROUNDS || aiTeamSet.size !== LIVE_DRAFT_TOTAL_ROUNDS) {
    return 'Live Draft lineups must include one player from each of 12 teams.'
  }

  for (const teamId of userTeamSet) {
    if (!aiTeamSet.has(teamId)) {
      return 'User and AI lineups must share the same round teams.'
    }
  }

  return null
}

export function setDailyMatchupBattingOrder(
  state: DailyMatchupDraftState,
  order: LivePlayer[],
): DailyMatchupDraftState {
  if (state.status !== 'lineup') return state
  if (order.length !== 9) return state
  return { ...state, battingOrder: order, status: 'complete' }
}

export function setLiveDraftBattingOrder(
  state: LiveDraftState,
  order: LivePlayer[],
): LiveDraftState {
  if (state.status !== 'lineup') return state
  if (order.length !== 9) return state
  return { ...state, userBattingOrder: order, status: 'complete' }
}

export function heuristicAiBattingOrder(players: LivePlayer[]): LivePlayer[] {
  const sorted = [...players].sort((a, b) => {
    const aObp = (a.grades.contact ?? 50) * 0.6 + (a.grades.speed ?? 50) * 0.2
    const bObp = (b.grades.contact ?? 50) * 0.6 + (b.grades.speed ?? 50) * 0.2
    return bObp - aObp
  })
  if (sorted.length <= 1) return sorted
  const leadoff = sorted.reduce((best, p) =>
    (p.grades.speed ?? 50) > (best.grades.speed ?? 50) ? p : best,
  )
  const rest = sorted.filter((p) => p.id !== leadoff.id)
  const power = [...rest].sort(
    (a, b) => (b.grades.power ?? 50) - (a.grades.power ?? 50),
  )
  return [leadoff, ...power.slice(0, 2), ...power.slice(2)]
}
