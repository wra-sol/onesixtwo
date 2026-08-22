import type {
  LiveLeaderboardEntryRow,
  LiveModeId,
  LiveSubmitPayload,
} from '../../shared/live/live-types'
import type { LiveSnapshot } from '../../shared/live/live-types'
import { enrichLiveLeaderboardRow } from '../../shared/live/live-share-sim'
import {
  buildLineupKey,
  computeRank,
  hasSubmissionForIp,
  orderBySql,
  type RankKey,
} from './leaderboard-core'

export type { LiveLeaderboardEntryRow, LiveSubmitPayload }

export const LIVE_LEADERBOARD_MAX = 30

export function buildLiveLineupKey(
  mode: LiveModeId,
  challengeDate: string,
  playerIds: readonly string[],
): string {
  return buildLineupKey(`${mode}:${challengeDate}`, playerIds)
}

type RawLiveLeaderboardRow = {
  initials: string
  mode: LiveModeId
  challenge_date: string
  target_date: string | null
  series_wins: number
  series_losses: number
  user_runs: number
  opponent_runs: number
  run_diff: number
  won_series: number
  created_at: number
  payload_json: string
}

function mapRawLiveLeaderboardRow(row: RawLiveLeaderboardRow) {
  return {
    initials: row.initials,
    mode: row.mode,
    challengeDate: row.challenge_date,
    targetDate: row.target_date ?? undefined,
    seriesWins: row.series_wins,
    seriesLosses: row.series_losses,
    userRuns: row.user_runs,
    opponentRuns: row.opponent_runs,
    runDiff: row.run_diff,
    wonSeries: row.won_series === 1,
    createdAt: row.created_at,
    payloadJson: row.payload_json,
  }
}

/**
 * THE ranking definition for live boards. ORDER BY, rank cascade, and any
 * in-memory comparator derive from this one list.
 */
type LiveRankEntry = Pick<
  LiveLeaderboardEntryRow,
  'wonSeries' | 'seriesWins' | 'runDiff' | 'userRuns'
>

const LIVE_RANK_KEYS: Array<RankKey<LiveRankEntry>> = [
  { column: 'won_series', value: (e) => (e.wonSeries ? 1 : 0) },
  { column: 'series_wins', value: (e) => e.seriesWins },
  { column: 'run_diff', value: (e) => e.runDiff },
  { column: 'user_runs', value: (e) => e.userRuns },
]

export async function fetchEnrichedLiveLeaderboardEntries(
  db: D1Database,
  mode: LiveModeId,
  challengeDate: string,
  limit: number,
  snapshot: LiveSnapshot,
): Promise<LiveLeaderboardEntryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT initials, mode, challenge_date, target_date, series_wins, series_losses,
              user_runs, opponent_runs, run_diff, won_series, created_at, payload_json
       FROM live_leaderboard_entries
       WHERE mode = ? AND challenge_date = ?
       ORDER BY ${orderBySql(LIVE_RANK_KEYS)}, created_at ASC
       LIMIT ?`,
    )
    .bind(mode, challengeDate, limit)
    .all<RawLiveLeaderboardRow>()

  return (results ?? []).map((row) =>
    enrichLiveLeaderboardRow(mapRawLiveLeaderboardRow(row), snapshot),
  )
}

export async function hasLiveSubmissionForIp(
  db: D1Database,
  submitterIp: string,
  mode: LiveModeId,
  challengeDate: string,
): Promise<boolean> {
  return hasSubmissionForIp(db, {
    table: 'live_leaderboard_entries',
    submitterIp,
    scope: [
      { column: 'mode', value: mode },
      { column: 'challenge_date', value: challengeDate },
    ],
  })
}

export async function insertLiveLeaderboardEntry(
  db: D1Database,
  entry: {
    id: string
    mode: LiveModeId
    challengeDate: string
    targetDate?: string
    initials: string
    seriesWins: number
    seriesLosses: number
    userRuns: number
    opponentRuns: number
    runDiff: number
    wonSeries: boolean
    lineupKey: string
    payloadJson: string
    submitterIp: string
    createdAt: number
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO live_leaderboard_entries (
         id, mode, challenge_date, target_date, initials, series_wins, series_losses,
         user_runs, opponent_runs, run_diff, won_series, lineup_key, payload_json,
         submitter_ip, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.id,
      entry.mode,
      entry.challengeDate,
      entry.targetDate ?? null,
      entry.initials,
      entry.seriesWins,
      entry.seriesLosses,
      entry.userRuns,
      entry.opponentRuns,
      entry.runDiff,
      entry.wonSeries ? 1 : 0,
      entry.lineupKey,
      entry.payloadJson,
      entry.submitterIp,
      entry.createdAt,
    )
    .run()
}

export async function computeLiveRank(
  db: D1Database,
  entry: Pick<
    LiveLeaderboardEntryRow,
    'mode' | 'challengeDate' | 'wonSeries' | 'seriesWins' | 'runDiff' | 'userRuns' | 'createdAt'
  >,
): Promise<number> {
  return computeRank<LiveRankEntry>(db, {
    table: 'live_leaderboard_entries',
    keys: LIVE_RANK_KEYS,
    entry,
    createdAt: entry.createdAt,
    scope: [
      { column: 'mode', value: entry.mode },
      { column: 'challenge_date', value: entry.challengeDate },
    ],
  })
}
