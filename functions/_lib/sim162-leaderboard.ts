import type { PostseasonResult } from '../../shared/live/sim162-season'
import {
  buildSim162SharePath,
  SIM162_BATTING_ORDER_SIZE,
  SIM162_ROTATION_SIZE,
  SIM162_ROSTER_SIZE,
  type Sim162LeaderboardEntryRow,
  type Sim162Pool,
  type Sim162ShareInput,
} from '../../src/lib/sim162-share-url'
import {
  buildLineupKey,
  computeRank,
  hasSubmissionForIp,
  orderBySql,
  type RankKey,
} from './leaderboard-core'
import { SUBMIT_ERROR_MESSAGES } from './leaderboard'

export type { Sim162LeaderboardEntryRow, Sim162Pool, Sim162ShareInput }

export const SIM162_LEADERBOARD_MAX = 50

export const POSTSEASON_RANK: Record<PostseasonResult, number> = {
  missed: 1,
  wc: 2,
  ds: 3,
  lcs: 4,
  'ws-runner-up': 5,
  'ws-champs': 6,
}

export type Sim162StoredPayload = Sim162ShareInput & {
  initials: string
}

export function buildSim162LineupKey(
  pool: Sim162Pool,
  playerIds: readonly string[],
): string {
  return buildLineupKey(pool, playerIds)
}

type RawSim162LeaderboardRow = {
  initials: string
  pool: Sim162Pool
  wins: number
  losses: number
  postseason_result: PostseasonResult
  won_world_series: number
  user_qualified: number
  created_at: number
  payload_json: string
}

function enrichSim162LeaderboardRow(
  row: RawSim162LeaderboardRow,
): Sim162LeaderboardEntryRow {
  let sharePath = ''
  try {
    const payload = JSON.parse(row.payload_json) as Sim162StoredPayload
    sharePath = buildSim162SharePath({
      pool: payload.pool,
      challengeDate: payload.challengeDate,
      playerIds: payload.playerIds,
      battingOrderIds: payload.battingOrderIds,
      rotationOrderIds: payload.rotationOrderIds,
      simSeed: payload.simSeed,
    })
  } catch {
    // Fall through to empty share path.
  }

  return {
    initials: row.initials,
    pool: row.pool,
    wins: row.wins,
    losses: row.losses,
    postseasonResult: row.postseason_result,
    wonWorldSeries: row.won_world_series === 1,
    userQualified: row.user_qualified === 1,
    createdAt: row.created_at,
    sharePath,
  }
}

/**
 * THE ranking definition for the Sim 162 board. ORDER BY and rank cascade
 * derive from this one list.
 */
type Sim162RankEntry = {
  wonWorldSeries: boolean
  wins: number
  postseasonRank: number
}

const SIM162_RANK_KEYS: Array<RankKey<Sim162RankEntry>> = [
  { column: 'won_world_series', value: (e) => (e.wonWorldSeries ? 1 : 0) },
  { column: 'wins', value: (e) => e.wins },
  { column: 'postseason_rank', value: (e) => e.postseasonRank },
]

export async function fetchSim162LeaderboardEntries(
  db: D1Database,
  limit: number,
): Promise<Sim162LeaderboardEntryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT initials, pool, wins, losses, postseason_result, won_world_series,
              user_qualified, created_at, payload_json
       FROM sim162_leaderboard_entries
       ORDER BY ${orderBySql(SIM162_RANK_KEYS)}, created_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<RawSim162LeaderboardRow>()

  return (results ?? []).map(enrichSim162LeaderboardRow)
}

export async function hasSim162SubmissionForIp(
  db: D1Database,
  submitterIp: string,
): Promise<boolean> {
  return hasSubmissionForIp(db, {
    table: 'sim162_leaderboard_entries',
    submitterIp,
  })
}

export async function insertSim162LeaderboardEntry(
  db: D1Database,
  entry: {
    id: string
    pool: Sim162Pool
    initials: string
    wins: number
    losses: number
    postseasonResult: PostseasonResult
    postseasonRank: number
    wonWorldSeries: boolean
    userQualified: boolean
    lineupKey: string
    payloadJson: string
    submitterIp: string
    createdAt: number
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sim162_leaderboard_entries (
         id, pool, initials, wins, losses, postseason_result, postseason_rank,
         won_world_series, user_qualified, lineup_key, payload_json,
         submitter_ip, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.id,
      entry.pool,
      entry.initials,
      entry.wins,
      entry.losses,
      entry.postseasonResult,
      entry.postseasonRank,
      entry.wonWorldSeries ? 1 : 0,
      entry.userQualified ? 1 : 0,
      entry.lineupKey,
      entry.payloadJson,
      entry.submitterIp,
      entry.createdAt,
    )
    .run()
}

export async function computeSim162Rank(
  db: D1Database,
  entry: {
    wonWorldSeries: boolean
    wins: number
    postseasonRank: number
    createdAt: number
  },
): Promise<number> {
  return computeRank<Sim162RankEntry>(db, {
    table: 'sim162_leaderboard_entries',
    keys: SIM162_RANK_KEYS,
    entry,
    createdAt: entry.createdAt,
  })
}

type Sim162SubmitBody = {
  pool: unknown
  initials: unknown
  challengeDate: unknown
  playerIds: unknown
  battingOrderIds: unknown
  rotationOrderIds: unknown
}

export type ParsedSim162Submit =
  | {
      ok: true
      pool: Sim162Pool
      challengeDate: string
      playerIds: string[]
      battingOrderIds: string[]
      rotationOrderIds: string[]
    }
  | { ok: false; error: string }

/**
 * Structural validation only. Claimed results (wins/losses/postseason) are
 * not part of the submission contract — the server derives them by re-sim.
 */
export function parseSim162SubmitPayload(body: unknown): ParsedSim162Submit {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: SUBMIT_ERROR_MESSAGES.invalid_json }
  }

  const record = body as Sim162SubmitBody

  const pool = record.pool
  if (pool !== 'live' && pool !== 'legends') {
    return { ok: false, error: 'Invalid pool.' }
  }

  const challengeDate =
    typeof record.challengeDate === 'string' ? record.challengeDate.trim() : ''
  if (!challengeDate) {
    return { ok: false, error: 'Missing challenge date.' }
  }

  const playerIds = record.playerIds
  if (
    !Array.isArray(playerIds) ||
    playerIds.length !== SIM162_ROSTER_SIZE ||
    !playerIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return { ok: false, error: `Roster must include ${SIM162_ROSTER_SIZE} players.` }
  }

  const seen = new Set<string>()
  for (const id of playerIds) {
    if (seen.has(id)) {
      return { ok: false, error: 'Roster has duplicate players.' }
    }
    seen.add(id)
  }

  const battingOrderIds = record.battingOrderIds
  if (
    !Array.isArray(battingOrderIds) ||
    battingOrderIds.length !== SIM162_BATTING_ORDER_SIZE ||
    !battingOrderIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return {
      ok: false,
      error: `Batting order must include ${SIM162_BATTING_ORDER_SIZE} players.`,
    }
  }

  const rotationOrderIds = record.rotationOrderIds
  if (
    !Array.isArray(rotationOrderIds) ||
    rotationOrderIds.length !== SIM162_ROTATION_SIZE ||
    !rotationOrderIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return {
      ok: false,
      error: `Rotation must include ${SIM162_ROTATION_SIZE} pitchers.`,
    }
  }

  return {
    ok: true,
    pool,
    challengeDate,
    playerIds: playerIds as string[],
    battingOrderIds: battingOrderIds as string[],
    rotationOrderIds: rotationOrderIds as string[],
  }
}
