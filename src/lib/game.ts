import {
  DRAFT_BUCKETS,
  getPlayersForBucket,
  MIN_BUCKET_PLAYERS,
  PLAYER_BY_ID,
  PLAYERS,
} from '../data'
import { isModernEra } from '../data/franchises'
import {
  LINEUP_POSITIONS,
  type CategoryScore,
  type DraftBucket,
  type DraftHistoryEntry,
  type GameState,
  type Lineup,
  type LineupPosition,
  type Player,
  type RandomSource,
  type SeasonResult,
  type SpinIntent,
} from './types'

export const defaultRandom: RandomSource = () => Math.random()

export function createEmptyLineup(): Lineup {
  return LINEUP_POSITIONS.reduce(
    (lineup, position) => {
      lineup[position] = null
      return lineup
    },
    {} as Lineup,
  )
}

export function createInitialGameState(): GameState {
  return {
    round: 1,
    currentBucket: null,
    availablePlayers: [],
    selectedPlayerId: null,
    lineup: createEmptyLineup(),
    draftedPlayerIds: [],
    draftedPersonIds: [],
    history: [],
    status: 'intro',
    teamRespinUsed: false,
    yearRespinUsed: false,
    spinIntent: 'round',
  }
}

export function getPlayerDisabledReason(
  player: Player,
  state: GameState,
): string | null {
  if (state.draftedPersonIds.includes(player.personId)) {
    return 'Already drafted'
  }
  const open = getOpenPositions(state.lineup)
  if (!playerCanFillOpenPosition(player, open)) {
    const filled = player.positions.filter(
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

export function getOpenPositions(lineup: Lineup): LineupPosition[] {
  return LINEUP_POSITIONS.filter((position) => lineup[position] === null)
}

export function playerCanFillOpenPosition(
  player: Player,
  openPositions: LineupPosition[],
): boolean {
  return player.positions.some((position) => openPositions.includes(position))
}

export function getEligiblePositionsForPlayer(
  player: Player,
  lineup: Lineup,
): LineupPosition[] {
  const open = getOpenPositions(lineup)
  return player.positions.filter((position) => open.includes(position))
}

export function isLineupComplete(lineup: Lineup): boolean {
  return getOpenPositions(lineup).length === 0
}

export function filterAvailablePlayers(
  bucket: DraftBucket,
  state: GameState,
): Player[] {
  return getPlayersForBucket(bucket).filter(
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

export function getSpinEligibleBuckets(
  state: GameState,
): DraftBucket[] {
  return DRAFT_BUCKETS.filter((bucket) => {
    if (!isModernEra(bucket.era)) {
      return false
    }
    if (getPlayersForBucket(bucket).length < MIN_BUCKET_PLAYERS) {
      return false
    }
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

function pickRandomFromList<T>(
  items: T[],
  random: RandomSource,
): T | null {
  if (items.length === 0) {
    return null
  }
  const index = Math.floor(random() * items.length)
  return items[index] ?? null
}

export function getTeamRespinCandidates(state: GameState): DraftBucket[] {
  const bucket = state.currentBucket
  if (!bucket) {
    return []
  }
  const active =
    state.status === 'picking' ||
    (state.status === 'spinning' && state.spinIntent === 'team')
  if (!active) {
    return []
  }
  return getSpinEligibleBuckets(state).filter(
    (b) => b.era === bucket.era && b.teamId !== bucket.teamId,
  )
}

export function getYearRespinCandidates(state: GameState): DraftBucket[] {
  const bucket = state.currentBucket
  if (!bucket) {
    return []
  }
  const active =
    state.status === 'picking' ||
    (state.status === 'spinning' && state.spinIntent === 'year')
  if (!active) {
    return []
  }
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
  if (!canRespinTeam(state)) {
    return state
  }
  return {
    ...state,
    status: 'spinning',
    spinIntent: 'team',
    selectedPlayerId: null,
  }
}

export function requestYearRespin(state: GameState): GameState {
  if (!canRespinYear(state)) {
    return state
  }
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
  const intent: SpinIntent = state.spinIntent
  if (intent === 'team') {
    return applyRespinTeam(state, random)
  }
  if (intent === 'year') {
    return applyRespinYear(state, random)
  }
  return applySpin(state, random)
}

export function startGame(state: GameState): GameState {
  return {
    ...state,
    status: 'spinning',
    spinIntent: 'round',
  }
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
  const availablePlayers = filterAvailablePlayers(bucket, state)
  return {
    ...state,
    status: 'picking',
    spinIntent: 'round',
    currentBucket: bucket,
    availablePlayers,
    selectedPlayerId: null,
  }
}

export function selectPlayer(state: GameState, playerId: string): GameState {
  const player = state.availablePlayers.find((p) => p.id === playerId)
  if (!player) {
    return state
  }
  const eligible = getEligiblePositionsForPlayer(player, state.lineup)
  if (eligible.length === 0) {
    return state
  }
  return {
    ...state,
    status: 'assigning',
    selectedPlayerId: playerId,
  }
}

export function canAssignPlayer(
  state: GameState,
  position: LineupPosition,
): boolean {
  if (!state.selectedPlayerId) {
    return false
  }
  const player = PLAYER_BY_ID.get(state.selectedPlayerId)
  if (!player) {
    return false
  }
  if (state.lineup[position] !== null) {
    return false
  }
  return player.positions.includes(position)
}

export function assignPlayer(
  state: GameState,
  position: LineupPosition,
): GameState {
  if (!canAssignPlayer(state, position)) {
    return state
  }
  const player = PLAYER_BY_ID.get(state.selectedPlayerId!)!
  const lineup = { ...state.lineup, [position]: player }
  const draftedPlayerIds = [...state.draftedPlayerIds, player.id]
  const draftedPersonIds = [...state.draftedPersonIds, player.personId]
  const historyEntry: DraftHistoryEntry = {
    round: state.round,
    teamName: state.currentBucket?.teamName ?? player.teamName,
    era: state.currentBucket?.era ?? player.era,
    playerName: player.name,
    position,
  }
  const history = [...state.history, historyEntry]

  if (isLineupComplete(lineup)) {
    return {
      ...state,
      lineup,
      draftedPlayerIds,
      draftedPersonIds,
      history,
      selectedPlayerId: null,
      currentBucket: null,
      availablePlayers: [],
      status: 'complete',
      round: 9,
    }
  }

  const nextRound = state.round + 1
  return {
    ...state,
    lineup,
    draftedPlayerIds,
    draftedPersonIds,
    history,
    selectedPlayerId: null,
    currentBucket: null,
    availablePlayers: [],
    round: nextRound,
    status: 'spinning',
    spinIntent: 'round',
  }
}

export function restartGame(): GameState {
  return createInitialGameState()
}

export function scorePlayer(player: Player): number {
  return player.ratings.overall
}

export const PLAYER_CATEGORY_LABELS = [
  'Contact',
  'Power',
  'Speed',
  'Run Production',
  'Run Prevention',
  'Control',
  'Dominance',
  'Workload',
] as const

export type PlayerCategoryLabel = (typeof PLAYER_CATEGORY_LABELS)[number]

export function getPlayerCategories(player: Player): CategoryScore[] {
  if (player.role === 'pitcher') {
    return [
      { label: 'Run Prevention', value: player.ratings.era },
      { label: 'Control', value: player.ratings.whip },
      { label: 'Dominance', value: player.ratings.strikeouts },
      { label: 'Workload', value: player.ratings.workload },
    ]
  }
  return [
    { label: 'Contact', value: player.ratings.contact },
    { label: 'Power', value: player.ratings.power },
    { label: 'Speed', value: player.ratings.speed },
    { label: 'Run Production', value: player.ratings.runProduction },
  ]
}

export function getPlayerCategoryValue(
  player: Player,
  label: string,
): number | null {
  const category = getPlayerCategories(player).find((c) => c.label === label)
  return category?.value ?? null
}

export function comparePlayersByCategory(
  a: Player,
  b: Player,
  label: string,
): number {
  const aValue = getPlayerCategoryValue(a, label)
  const bValue = getPlayerCategoryValue(b, label)
  if (aValue === null && bValue === null) {
    return 0
  }
  if (aValue === null) {
    return 1
  }
  if (bValue === null) {
    return -1
  }
  return bValue - aValue
}

export function getPlayerTopCategory(player: Player): CategoryScore {
  const categories = getPlayerCategories(player)
  return categories.reduce(
    (best, category) => (category.value > best.value ? category : best),
    categories[0]!,
  )
}

export function getPlayerWeakestCategory(player: Player): CategoryScore {
  const categories = getPlayerCategories(player)
  return categories.reduce(
    (worst, category) => (category.value < worst.value ? category : worst),
    categories[0]!,
  )
}

export function calculateTeamScore(lineup: Lineup): number | null {
  if (!isLineupComplete(lineup)) {
    return null
  }
  const players = LINEUP_POSITIONS.map((pos) => lineup[pos]!).filter(Boolean)
  const average =
    players.reduce((sum, p) => sum + scorePlayer(p), 0) / players.length

  let bonus = 0
  if (players.some((p) => p.ratings.overall >= 95)) {
    bonus += 3
  }

  const hitters = players.filter((p) => p.role === 'hitter')
  if (hitters.length > 0) {
    const avgContact =
      hitters.reduce((s, p) => s + p.ratings.contact, 0) / hitters.length
    const avgPower =
      hitters.reduce((s, p) => s + p.ratings.power, 0) / hitters.length
    const avgSpeed =
      hitters.reduce((s, p) => s + p.ratings.speed, 0) / hitters.length
    if (avgContact >= 70 && avgPower >= 70 && avgSpeed >= 70) {
      bonus += 2
    }
  }

  return Math.min(100, Math.round(average + bonus))
}

export function projectWins(teamScore: number): { wins: number; losses: number } {
  let wins: number
  if (teamScore < 50) {
    wins = Math.round(teamScore * 1.62)
  } else if (teamScore < 75) {
    wins = Math.round(81 + ((teamScore - 50) / 25) * 24)
  } else if (teamScore < 90) {
    wins = Math.round(105 + ((teamScore - 75) / 15) * 20)
  } else if (teamScore < 98) {
    wins = Math.round(125 + ((teamScore - 90) / 8) * 25)
  } else {
    wins = 162
  }
  wins = Math.min(162, Math.max(0, wins))
  return { wins, losses: 162 - wins }
}

export function getHeadline(wins: number, losses: number): string {
  if (wins === 162 && losses === 0) {
    return 'PERFECT SEASON! You went 162-0!'
  }
  if (wins >= 120) {
    return 'Dynasty! Your lineup dominated the league.'
  }
  if (wins >= 100) {
    return 'Contender! A strong season, but not perfect.'
  }
  if (wins >= 85) {
    return 'Playoff push — close, but 162-0 slipped away.'
  }
  return 'Rebuild season. Try another draft!'
}

export function calculateSeasonResult(lineup: Lineup): SeasonResult | null {
  const teamScore = calculateTeamScore(lineup)
  if (teamScore === null) {
    return null
  }
  const { wins, losses } = projectWins(teamScore)
  const players = LINEUP_POSITIONS.map((pos) => lineup[pos]!).filter(Boolean)

  const contact =
    players
      .filter((p) => p.role === 'hitter')
      .reduce((s, p) => s + p.ratings.contact, 0) /
    Math.max(1, players.filter((p) => p.role === 'hitter').length)
  const power =
    players
      .filter((p) => p.role === 'hitter')
      .reduce((s, p) => s + p.ratings.power, 0) /
    Math.max(1, players.filter((p) => p.role === 'hitter').length)
  const speed =
    players
      .filter((p) => p.role === 'hitter')
      .reduce((s, p) => s + p.ratings.speed, 0) /
    Math.max(1, players.filter((p) => p.role === 'hitter').length)
  const runPrevention =
    players
      .filter((p) => p.role === 'pitcher')
      .reduce((s, p) => s + p.ratings.era, 0) /
    Math.max(1, players.filter((p) => p.role === 'pitcher').length)

  const categories: CategoryScore[] = [
    { label: 'Contact', value: Math.round(contact) },
    { label: 'Power', value: Math.round(power) },
    { label: 'Speed', value: Math.round(speed) },
    { label: 'Run Prevention', value: Math.round(runPrevention) },
  ]

  const lineupPlayers = LINEUP_POSITIONS.map((pos) => ({
    position: pos,
    player: lineup[pos]!,
  }))
  const sorted = [...lineupPlayers].sort(
    (a, b) =>
      getPlayerTopCategory(b.player).value -
      getPlayerTopCategory(a.player).value,
  )
  const best = sorted[0]
  const weakest = sorted[sorted.length - 1]
  const gamesFromPerfect = 162 - wins

  const shareText = `162-0: I built an all-time lineup and projected ${wins}-${losses}. Can you beat it?`

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
  }
}

export function getFilledCount(lineup: Lineup): number {
  return LINEUP_POSITIONS.filter((p) => lineup[p] !== null).length
}

export { PLAYERS, DRAFT_BUCKETS }
