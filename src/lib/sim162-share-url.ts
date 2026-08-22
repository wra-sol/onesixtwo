export type Sim162Pool = 'live' | 'legends'

export type Sim162ShareInput = {
  pool: Sim162Pool
  challengeDate: string
  playerIds: string[]
  battingOrderIds: string[]
  rotationOrderIds: string[]
  simSeed: string
}

export type Sim162ShareValidationError = { ok: false; error: string }

const POOL_PARAM = 'pool'
const DATE_PARAM = 'date'
const PLAYERS_PARAM = 'p'
const BATTING_ORDER_PARAM = 'bo'
const ROTATION_PARAM = 'ro'
const SEED_PARAM = 'seed'

export const SIM162_ROSTER_SIZE = 25
export const SIM162_BATTING_ORDER_SIZE = 9
export const SIM162_ROTATION_SIZE = 5

function parseIdList(raw: string | null): string[] | null {
  if (!raw?.trim()) return null
  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

export function buildSim162SharePath(input: Sim162ShareInput): string {
  const params = new URLSearchParams()
  params.set(POOL_PARAM, input.pool)
  params.set(DATE_PARAM, input.challengeDate)
  params.set(PLAYERS_PARAM, input.playerIds.join(','))
  params.set(BATTING_ORDER_PARAM, input.battingOrderIds.join(','))
  params.set(ROTATION_PARAM, input.rotationOrderIds.join(','))
  params.set(SEED_PARAM, input.simSeed)
  return `/sim162-share?${params.toString()}`
}

export function parseSim162ShareParams(
  searchParams: URLSearchParams,
): Sim162ShareInput | Sim162ShareValidationError {
  const pool = searchParams.get(POOL_PARAM)
  if (pool !== 'live' && pool !== 'legends') {
    return { ok: false, error: 'Invalid or missing pool.' }
  }

  const challengeDate = searchParams.get(DATE_PARAM)
  if (!challengeDate) {
    return { ok: false, error: 'Missing challenge date.' }
  }

  const playerIds = parseIdList(searchParams.get(PLAYERS_PARAM))
  if (!playerIds || playerIds.length !== SIM162_ROSTER_SIZE) {
    return { ok: false, error: 'Invalid roster in share link.' }
  }

  const battingOrderIds = parseIdList(searchParams.get(BATTING_ORDER_PARAM))
  if (!battingOrderIds || battingOrderIds.length !== SIM162_BATTING_ORDER_SIZE) {
    return { ok: false, error: 'Invalid batting order in share link.' }
  }

  const rotationOrderIds = parseIdList(searchParams.get(ROTATION_PARAM))
  if (!rotationOrderIds || rotationOrderIds.length !== SIM162_ROTATION_SIZE) {
    return { ok: false, error: 'Invalid rotation in share link.' }
  }

  const simSeed = searchParams.get(SEED_PARAM)
  if (!simSeed) {
    return { ok: false, error: 'Missing simulation seed.' }
  }

  return {
    pool,
    challengeDate,
    playerIds,
    battingOrderIds,
    rotationOrderIds,
    simSeed,
  }
}

export function isParsedSim162Share(
  value: Sim162ShareInput | Sim162ShareValidationError,
): value is Sim162ShareInput {
  return !('ok' in value)
}

export function sim162ShareValidationMessage(
  error: Sim162ShareValidationError,
): string {
  return error.error
}

/**
 * Leaderboard row contract for the Sim 162 board. Owned here (the sim162
 * contract module) so the client and the Pages Functions share one
 * definition without the client importing server code.
 */
export type Sim162LeaderboardEntryRow = {
  initials: string
  pool: Sim162Pool
  wins: number
  losses: number
  postseasonResult: import('@shared/live/sim162-season').PostseasonResult
  wonWorldSeries: boolean
  userQualified: boolean
  createdAt: number
  sharePath: string
}
