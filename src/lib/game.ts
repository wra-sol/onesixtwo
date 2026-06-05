import {
  formatLineupShareSummary,
  formatShareText,
} from './brand'
import { getModeDataset } from '../data/modes'
import { isPlayableEra } from '../data/franchises'
import {
  createEmptyLineup,
  getActiveLineupPositions,
  lineupEntries,
  lineupPlayers,
  rosterFormatSlotCount,
} from './roster-format'
import { getPlayerEligiblePositions } from './player-eligibility'
import {
  getPlayerTopCategory,
  getPlayerWeakestCategory,
  comparePlayersByCategory,
  getPlayerCategories,
  getPlayerCategoryValue,
  PLAYER_CATEGORY_LABELS,
} from './player-categories'
import type { PlayerCategoryLabel } from './player-categories'
import {
  buildScoreExplanation,
  calculateTeamScoreFromLineup,
} from './team-scoring'
import { getBattingRatings } from './player-ratings'
import type {
  CategoryScore,
  DraftBucket,
  Era,
  DraftHistoryEntry,
  GameState,
  Lineup,
  LineupPosition,
  Player,
  RandomSource,
  GameModeId,
  RosterFormatId,
  SeasonResult,
  SeasonResultOptions,
  TeamId,
} from './types'
import { buildRosterScorecard } from './scorecard'
import {
  buildSeasonMoments,
  getHeadline,
  getSeasonTier,
  getSignatureMoment,
} from './recap'
import { simulateSeason } from './simulation'
import { calculateRunPrevention } from './run-prevention'

export { createEmptyLineup } from './roster-format'
export {
  getPlayerCategories,
  getPlayerCategoryValue,
  comparePlayersByCategory,
  getPlayerTopCategory,
  getPlayerWeakestCategory,
  PLAYER_CATEGORY_LABELS,
}
export type { PlayerCategoryLabel }

export const defaultRandom: RandomSource = () => Math.random()
export const MAX_PLAYERS_PER_ERA = 2

function modeData(gameModeId: GameModeId) {
  return getModeDataset(gameModeId)
}

export function createInitialGameState(
  rosterFormatId: RosterFormatId = 'classic',
  gameModeId: GameModeId = 'all-time',
): GameState {
  return {
    gameModeId,
    rosterFormatId,
    round: 1,
    currentBucket: null,
    availablePlayers: [],
    selectedPlayerId: null,
    lineup: createEmptyLineup(),
    draftedPlayerIds: [],
    draftedPersonIds: [],
    draftedTeamIds: [],
    draftedEras: [],
    history: [],
    status: 'intro',
    teamRespinUsed: false,
    yearRespinUsed: false,
    spinIntent: 'round',
  }
}

export function getOpenPositions(
  lineup: Lineup,
  formatId: RosterFormatId,
): LineupPosition[] {
  return getActiveLineupPositions(formatId).filter(
    (position) => lineup[position] === null,
  )
}

export function getDraftedEraCount(state: GameState, era: Era): number {
  return state.draftedEras.filter((draftedEra) => draftedEra === era).length
}

export function teamIsDraftable(state: GameState, teamId: TeamId): boolean {
  return !state.draftedTeamIds.includes(teamId)
}

export function eraIsDraftable(state: GameState, era: Era): boolean {
  return getDraftedEraCount(state, era) < MAX_PLAYERS_PER_ERA
}

function getSwitchDestinationForPosition(
  lineup: Lineup,
  position: LineupPosition,
  formatId: RosterFormatId,
): LineupPosition | null {
  const player = lineup[position]
  if (!player) return null
  const open = getOpenPositions(lineup, formatId)
  const eligible = getPlayerEligiblePositions(player, formatId)
  return (
    eligible.find((pos) => pos !== position && open.includes(pos)) ?? null
  )
}

export function getEligiblePositionsForPlayer(
  player: Player,
  lineup: Lineup,
  formatId: RosterFormatId,
): LineupPosition[] {
  const open = getOpenPositions(lineup, formatId)
  const eligible = getPlayerEligiblePositions(player, formatId)
  return eligible.filter((position) => {
    if (open.includes(position)) return true
    return getSwitchDestinationForPosition(lineup, position, formatId) !== null
  })
}

export function isLineupComplete(
  lineup: Lineup,
  formatId: RosterFormatId,
): boolean {
  return getOpenPositions(lineup, formatId).length === 0
}

export function getPlayerDisabledReason(
  player: Player,
  state: GameState,
): string | null {
  if (state.draftedPersonIds.includes(player.personId)) {
    return 'Already drafted'
  }
  if (state.draftedTeamIds.includes(player.teamId)) {
    return `${player.teamName} used`
  }
  if (getDraftedEraCount(state, player.era) >= MAX_PLAYERS_PER_ERA) {
    return `${player.era} maxed`
  }
  const eligible = getEligiblePositionsForPlayer(
    player,
    state.lineup,
    state.rosterFormatId,
  )
  if (eligible.length === 0) {
    const filled = getPlayerEligiblePositions(player, state.rosterFormatId).filter(
      (position) => state.lineup[position] !== null,
    )
    if (filled.length > 0) {
      return `${filled.join(', ')} filled`
    }
    return 'No open positions'
  }
  return null
}

export function playerIsPickable(player: Player, state: GameState): boolean {
  return getPlayerDisabledReason(player, state) === null
}

export function filterAvailablePlayers(
  bucket: DraftBucket,
  state: GameState,
): Player[] {
  const dataset = modeData(state.gameModeId)
  if (!teamIsDraftable(state, bucket.teamId) || !eraIsDraftable(state, bucket.era)) {
    return []
  }
  return dataset.getPlayersForBucket(bucket).filter(
    (player) => !state.draftedPersonIds.includes(player.personId),
  )
}

function bucketHasPickablePlayer(
  bucket: DraftBucket,
  state: GameState,
): boolean {
  return filterAvailablePlayers(bucket, state).some((player) =>
    playerIsPickable(player, state),
  )
}

export function getSpinEligibleBuckets(state: GameState): DraftBucket[] {
  const dataset = modeData(state.gameModeId)
  return dataset.draftBuckets.filter((bucket) => {
    if (!isPlayableEra(bucket.era)) return false
    if (dataset.getPlayersForBucket(bucket).length < dataset.minBucketPlayers) {
      return false
    }
    if (!teamIsDraftable(state, bucket.teamId)) return false
    if (!eraIsDraftable(state, bucket.era)) return false
    return bucketHasPickablePlayer(bucket, state)
  })
}

export function pickRandomBucket(
  state: GameState,
  random: RandomSource = defaultRandom,
): DraftBucket | null {
  const eligible = getSpinEligibleBuckets(state)
  return pickRandomFromList(eligible, random)
}

function pickRandomFromList<T>(items: T[], random: RandomSource): T | null {
  if (items.length === 0) return null
  const index = Math.floor(random() * items.length)
  return items[index] ?? null
}

export function getTeamRespinCandidates(state: GameState): DraftBucket[] {
  const bucket = state.currentBucket
  if (!bucket) return []
  const active =
    state.status === 'picking' ||
    (state.status === 'spinning' && state.spinIntent === 'team')
  if (!active) return []
  return getSpinEligibleBuckets(state).filter(
    (b) => b.era === bucket.era && b.teamId !== bucket.teamId,
  )
}

export function getYearRespinCandidates(state: GameState): DraftBucket[] {
  const bucket = state.currentBucket
  if (!bucket) return []
  const active =
    state.status === 'picking' ||
    (state.status === 'spinning' && state.spinIntent === 'year')
  if (!active) return []
  return getSpinEligibleBuckets(state).filter(
    (b) => b.teamId === bucket.teamId && b.era !== bucket.era,
  )
}

export function canRespinTeam(state: GameState): boolean {
  return (
    !state.teamRespinUsed &&
    state.status === 'picking' &&
    getTeamRespinCandidates(state).length > 0
  )
}

export function canRespinYear(state: GameState): boolean {
  return (
    !state.yearRespinUsed &&
    state.status === 'picking' &&
    getYearRespinCandidates(state).length > 0
  )
}

function applyBucketToPicking(
  state: GameState,
  bucket: DraftBucket,
  flags: { teamRespinUsed?: boolean; yearRespinUsed?: boolean },
): GameState {
  return {
    ...state,
    status: 'picking',
    spinIntent: 'round',
    currentBucket: bucket,
    availablePlayers: filterAvailablePlayers(bucket, state),
    selectedPlayerId: null,
    teamRespinUsed: flags.teamRespinUsed ?? state.teamRespinUsed,
    yearRespinUsed: flags.yearRespinUsed ?? state.yearRespinUsed,
  }
}

export function requestTeamRespin(state: GameState): GameState {
  if (!canRespinTeam(state)) return state
  return {
    ...state,
    status: 'spinning',
    spinIntent: 'team',
    selectedPlayerId: null,
  }
}

export function requestYearRespin(state: GameState): GameState {
  if (!canRespinYear(state)) return state
  return {
    ...state,
    status: 'spinning',
    spinIntent: 'year',
    selectedPlayerId: null,
  }
}

export function applyRespinTeam(
  state: GameState,
  random: RandomSource = defaultRandom,
): GameState {
  const bucket = pickRandomFromList(getTeamRespinCandidates(state), random)
  if (!bucket) {
    return { ...state, status: 'picking', spinIntent: 'round' }
  }
  return applyBucketToPicking(state, bucket, { teamRespinUsed: true })
}

export function applyRespinYear(
  state: GameState,
  random: RandomSource = defaultRandom,
): GameState {
  const bucket = pickRandomFromList(getYearRespinCandidates(state), random)
  if (!bucket) {
    return { ...state, status: 'picking', spinIntent: 'round' }
  }
  return applyBucketToPicking(state, bucket, { yearRespinUsed: true })
}

export function resolveSpin(
  state: GameState,
  random: RandomSource = defaultRandom,
): GameState {
  if (state.spinIntent === 'team') return applyRespinTeam(state, random)
  if (state.spinIntent === 'year') return applyRespinYear(state, random)
  return applySpin(state, random)
}

export function startGame(state: GameState): GameState {
  return { ...state, status: 'spinning', spinIntent: 'round' }
}

export function applySpin(
  state: GameState,
  random: RandomSource = defaultRandom,
): GameState {
  const bucket = pickRandomBucket(state, random)
  if (!bucket) {
    return {
      ...state,
      status: 'stuck',
      currentBucket: null,
      availablePlayers: [],
      selectedPlayerId: null,
    }
  }
  return {
    ...state,
    status: 'picking',
    spinIntent: 'round',
    currentBucket: bucket,
    availablePlayers: filterAvailablePlayers(bucket, state),
    selectedPlayerId: null,
  }
}

export function selectPlayer(state: GameState, playerId: string): GameState {
  const player = state.availablePlayers.find((p) => p.id === playerId)
  if (!player) return state
  const eligible = getEligiblePositionsForPlayer(
    player,
    state.lineup,
    state.rosterFormatId,
  )
  if (eligible.length === 0) return state
  return { ...state, status: 'assigning', selectedPlayerId: playerId }
}

export function canAssignPlayer(
  state: GameState,
  position: LineupPosition,
): boolean {
  if (!state.selectedPlayerId) return false
  const player = modeData(state.gameModeId).playerById.get(state.selectedPlayerId)
  if (!player) return false
  const eligible = getPlayerEligiblePositions(player, state.rosterFormatId)
  if (!eligible.includes(position)) return false
  if (state.lineup[position] !== null) {
    return (
      getSwitchDestinationForPosition(
        state.lineup,
        position,
        state.rosterFormatId,
      ) !== null
    )
  }
  return true
}

export function assignPlayer(
  state: GameState,
  position: LineupPosition,
): GameState {
  if (!canAssignPlayer(state, position)) return state
  const player = modeData(state.gameModeId).playerById.get(state.selectedPlayerId!)!
  const displacedPlayer = state.lineup[position]
  const switchDestination = getSwitchDestinationForPosition(
    state.lineup,
    position,
    state.rosterFormatId,
  )
  const lineup = {
    ...state.lineup,
    ...(displacedPlayer && switchDestination
      ? { [switchDestination]: displacedPlayer }
      : {}),
    [position]: player,
  }
  const draftedPlayerIds = [...state.draftedPlayerIds, player.id]
  const draftedPersonIds = [...state.draftedPersonIds, player.personId]
  const draftedTeamIds = [...state.draftedTeamIds, player.teamId]
  const draftedEras = [...state.draftedEras, player.era]
  const historyEntry: DraftHistoryEntry = {
    round: state.round,
    teamName: state.currentBucket?.teamName ?? player.teamName,
    era: state.currentBucket?.era ?? player.era,
    playerName: player.name,
    position,
  }
  const history = [...state.history, historyEntry]
  const totalSlots = rosterFormatSlotCount(state.rosterFormatId)

  if (isLineupComplete(lineup, state.rosterFormatId)) {
    return {
      ...state,
      lineup,
      draftedPlayerIds,
      draftedPersonIds,
      draftedTeamIds,
      draftedEras,
      history,
      selectedPlayerId: null,
      currentBucket: null,
      availablePlayers: [],
      status: 'complete',
      round: totalSlots,
    }
  }

  return {
    ...state,
    lineup,
    draftedPlayerIds,
    draftedPersonIds,
    draftedTeamIds,
    draftedEras,
    history,
    selectedPlayerId: null,
    currentBucket: null,
    availablePlayers: [],
    round: state.round + 1,
    status: 'spinning',
    spinIntent: 'round',
  }
}

export function restartGame(
  rosterFormatId?: RosterFormatId,
  gameModeId: GameModeId = 'all-time',
): GameState {
  return createInitialGameState(rosterFormatId ?? 'classic', gameModeId)
}

export function scorePlayer(player: Player): number {
  return player.ratings.overall
}

export function calculateTeamScore(
  lineup: Lineup,
  formatId: RosterFormatId = 'classic',
): number | null {
  return calculateTeamScoreFromLineup(lineup, formatId)
}

export function projectWins(teamScore: number): { wins: number; losses: number } {
  let wins: number
  if (teamScore < 50) {
    wins = Math.round(teamScore * 1.62)
  } else if (teamScore < 75) {
    wins = Math.round(81 + ((teamScore - 50) / 25) * 24)
  } else if (teamScore < 90) {
    wins = Math.round(105 + ((teamScore - 75) / 15) * 20)
  } else if (teamScore < 100) {
    wins = Math.round(128 + ((teamScore - 90) / 10) * 44)
  } else {
    wins = 162
  }
  wins = Math.min(162, Math.max(0, wins))
  return { wins, losses: 162 - wins }
}

export function calculateSeasonResult(
  lineup: Lineup,
  options?: SeasonResultOptions & { rosterFormatId?: RosterFormatId },
): SeasonResult | null {
  const formatId = options?.rosterFormatId ?? 'classic'
  const teamScore = calculateTeamScore(lineup, formatId)
  if (teamScore === null) return null

  const simulation = simulateSeason(lineup, teamScore, {
    rerollSeed: options?.rerollSeed,
    rosterFormatId: formatId,
  })
  const { wins, losses } = simulation

  const scorecard = buildRosterScorecard(lineup, simulation, formatId)
  const scoreExplanation = buildScoreExplanation(lineup, formatId)
  const tier = getSeasonTier(wins, losses)
  const seasonMoments = buildSeasonMoments(
    simulation,
    scorecard.identity,
    scorecard.strengths,
  )
  const signatureMoment = getSignatureMoment(seasonMoments)

  const players = lineupPlayers(lineup, formatId)
  const batters = players.filter(
    (p) => p.role === 'hitter' || p.role === 'two-way',
  )

  const contact = avgRating(batters, (r) => r.contact)
  const power = avgRating(batters, (r) => r.power)
  const speed = avgRating(batters, (r) => r.speed)
  const runPrevention = calculateRunPrevention(lineup, formatId).value

  const categories: CategoryScore[] = [
    { label: 'Contact', value: Math.round(contact) },
    { label: 'Power', value: Math.round(power) },
    { label: 'Speed', value: Math.round(speed) },
    { label: 'Run Prevention', value: runPrevention },
  ]

  const entries = lineupEntries(lineup, formatId)
  const sorted = [...entries].sort(
    (a, b) =>
      getPlayerTopCategory(b.player).value -
      getPlayerTopCategory(a.player).value,
  )
  const best = sorted[0]
  const weakest = sorted[sorted.length - 1]
  const gamesFromPerfect = 162 - wins

  const activePositions = getActiveLineupPositions(formatId)
  const shareText = formatShareText({
    wins,
    losses,
    lineupSummary: formatLineupShareSummary(activePositions, lineup),
    mvpLine: best
      ? `MVP: ${best.player.name} (${best.position})`
      : null,
    tierLabel: tier.label,
    identityLabel: scorecard.identity.label,
    luckDelta: simulation.luckDelta,
    signatureMoment,
  })

  return {
    wins,
    losses,
    record: `${wins}-${losses}`,
    headline: getHeadline(wins, losses),
    teamScore,
    overallRating: teamScore,
    categories,
    isPerfectSeason: wins === 162 && losses === 0,
    bestPlayer: best
      ? {
          name: best.player.name,
          position: best.position,
          highlightCategory: getPlayerTopCategory(best.player),
        }
      : null,
    weakestPlayer: weakest
      ? {
          name: weakest.player.name,
          position: weakest.position,
          highlightCategory: getPlayerWeakestCategory(weakest.player),
        }
      : null,
    gamesFromPerfect,
    shareText,
    tier,
    identity: scorecard.identity,
    strengths: scorecard.strengths,
    riskFactors: scorecard.riskFactors,
    weaknesses: scorecard.riskFactors,
    seasonMoments,
    simulation,
    scorecard,
    scoreExplanation,
    rosterFormatId: formatId,
    expectedWins: simulation.expectedWins,
    luckDelta: simulation.luckDelta,
    signatureMoment,
  }
}

function avgRating(
  players: Player[],
  pick: (r: ReturnType<typeof getBattingRatings>) => number,
): number {
  if (players.length === 0) return 0
  return (
    players.reduce((s, p) => s + pick(getBattingRatings(p)), 0) / players.length
  )
}

export function getFilledCount(
  lineup: Lineup,
  formatId: RosterFormatId,
): number {
  return getActiveLineupPositions(formatId).filter((p) => lineup[p] !== null)
    .length
}

export function getPlayersForMode(gameModeId: GameModeId) {
  return modeData(gameModeId).players
}

export function getDraftBucketsForMode(gameModeId: GameModeId) {
  return modeData(gameModeId).draftBuckets
}
