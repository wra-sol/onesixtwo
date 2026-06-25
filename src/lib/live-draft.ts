import {
  createEmptyDailyLineup,
  dailyLineupIsComplete,
  dailyLineupOpenPositions,
  defaultBattingOrderFromLineup,
  playerEligibleForDailyPosition,
  type DailyLineup,
  type DailyLineupPosition,
} from './daily-roster'
import type {
  DailyMatchupDraftState,
  LiveDraftPick,
  LiveDraftState,
  LiveDraftSnapshot,
  LivePlayer,
  OpponentRoster,
} from './live-types'

const TOTAL_PICKS = 24

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

export function createLiveDraftState(snapshot: LiveDraftSnapshot): LiveDraftState {
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
    userTeamIds: [],
    aiTeamIds: [],
    picks: [],
    status: 'drafting',
    userPicksFirst: snapshot.coinFlipUserFirst,
  }
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
): string | null {
  if (state.draftedPlayerIds.includes(player.id)) return 'Already drafted'
  if (state.userTeamIds.includes(player.teamId)) return `${player.teamAbbrev} used`
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

function aiPickPlayer(
  state: LiveDraftState,
  players: LivePlayer[],
  seed: string,
): LivePlayer | null {
  const random = createSeededRandom(`${seed}|pick${state.currentPick}`)
  const available = players.filter(
    (p) =>
      !state.draftedPlayerIds.includes(p.id) &&
      !state.aiTeamIds.includes(p.teamId) &&
      bestOpenPosition(p, state.aiLineup) !== null,
  )
  if (available.length === 0) return null

  const scored = available
    .map((p) => ({ player: p, score: scorePlayerForAi(p, state.aiLineup) }))
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

function applyAiPick(
  state: LiveDraftState,
  player: LivePlayer,
  pickNumber: number,
): LiveDraftState {
  const position = bestOpenPosition(player, state.aiLineup)
  if (!position) return state

  const pick: LiveDraftPick = {
    pickNumber,
    side: 'ai',
    playerId: player.id,
    position,
  }

  return {
    ...state,
    aiLineup: { ...state.aiLineup, [position]: player },
    draftedPlayerIds: [...state.draftedPlayerIds, player.id],
    aiTeamIds: [...state.aiTeamIds, player.teamId],
    picks: [...state.picks, pick],
    currentPick: pickNumber + 1,
  }
}

export function draftLiveUserPlayer(
  state: LiveDraftState,
  player: LivePlayer,
  players: LivePlayer[],
  simSeed: string,
  position?: DailyLineupPosition,
): LiveDraftState {
  if (getLiveDraftUserDisabledReason(player, state)) return state
  const slot = position ?? bestOpenPosition(player, state.userLineup)
  if (!slot) return state

  const pick: LiveDraftPick = {
    pickNumber: state.currentPick,
    side: 'user',
    playerId: player.id,
    position: slot,
  }

  const next: LiveDraftState = {
    ...state,
    userLineup: { ...state.userLineup, [slot]: player },
    draftedPlayerIds: [...state.draftedPlayerIds, player.id],
    userTeamIds: [...state.userTeamIds, player.teamId],
    picks: [...state.picks, pick],
    currentPick: state.currentPick + 1,
  }

  return advanceLiveDraftAfterPick(next, players, simSeed)
}

export function advanceLiveDraftAfterPick(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed?: string,
): LiveDraftState {
  let next = state

  while (
    next.currentPick <= TOTAL_PICKS &&
    snakeDraftSide(next.currentPick, next.userPicksFirst) === 'ai'
  ) {
    const aiPlayer = aiPickPlayer(next, players, simSeed ?? next.challengeDate)
    if (!aiPlayer) break
    next = applyAiPick(next, aiPlayer, next.currentPick)
  }

  if (dailyLineupIsComplete(next.userLineup) && dailyLineupIsComplete(next.aiLineup)) {
    return {
      ...next,
      status: 'lineup',
      userBattingOrder: defaultBattingOrderFromLineup(next.userLineup),
      aiBattingOrder: defaultBattingOrderFromLineup(next.aiLineup),
    }
  }

  return next
}

export function isUserTurn(state: LiveDraftState): boolean {
  if (state.status !== 'drafting') return false
  if (state.currentPick > TOTAL_PICKS) return false
  return snakeDraftSide(state.currentPick, state.userPicksFirst) === 'user'
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
