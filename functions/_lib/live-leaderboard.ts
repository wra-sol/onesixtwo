/* eslint-disable @typescript-eslint/triple-slash-reference -- Cloudflare D1 ambient types */
/// <reference path="./d1.d.ts" />
import type { LiveModeId } from '../../src/lib/live-types'

export type LiveLeaderboardEntryRow = {
  initials: string
  mode: LiveModeId
  challengeDate: string
  targetDate?: string
  seriesWins: number
  seriesLosses: number
  userRuns: number
  opponentRuns: number
  runDiff: number
  wonSeries: boolean
  createdAt: number
}

export type LiveSubmitPayload = {
  mode: LiveModeId
  challengeDate: string
  targetDate?: string
  initials: string
  playerIds: string[]
  battingOrderIds: string[]
  draftTranscript?: string
  simSeed: string
}

export const LIVE_LEADERBOARD_MAX = 30

export function compareLiveLeaderboardRows(
  a: Pick<
    LiveLeaderboardEntryRow,
    'wonSeries' | 'seriesWins' | 'runDiff' | 'userRuns' | 'createdAt'
  >,
  b: Pick<
    LiveLeaderboardEntryRow,
    'wonSeries' | 'seriesWins' | 'runDiff' | 'userRuns' | 'createdAt'
  >,
): number {
  if (a.wonSeries !== b.wonSeries) return a.wonSeries ? -1 : 1
  if (a.seriesWins !== b.seriesWins) return b.seriesWins - a.seriesWins
  if (a.runDiff !== b.runDiff) return b.runDiff - a.runDiff
  if (a.userRuns !== b.userRuns) return b.userRuns - a.userRuns
  return a.createdAt - b.createdAt
}

export function buildLiveLineupKey(
  mode: LiveModeId,
  challengeDate: string,
  playerIds: readonly string[],
): string {
  return `${mode}:${challengeDate}:${[...playerIds].sort().join(',')}`
}

export async function fetchLiveLeaderboardEntries(
  db: D1Database,
  mode: LiveModeId,
  challengeDate: string,
  limit: number,
): Promise<LiveLeaderboardEntryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT initials, mode, challenge_date, target_date, series_wins, series_losses,
              user_runs, opponent_runs, run_diff, won_series, created_at
       FROM live_leaderboard_entries
       WHERE mode = ? AND challenge_date = ?
       ORDER BY won_series DESC, series_wins DESC, run_diff DESC, user_runs DESC, created_at ASC
       LIMIT ?`,
    )
    .bind(mode, challengeDate, limit)
    .all<{
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
    }>()

  return (results ?? []).map((row) => ({
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
  }))
}

export async function hasLiveSubmissionForIp(
  db: D1Database,
  submitterIp: string,
  mode: LiveModeId,
  challengeDate: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS found FROM live_leaderboard_entries
       WHERE submitter_ip = ? AND mode = ? AND challenge_date = ?
       LIMIT 1`,
    )
    .bind(submitterIp, mode, challengeDate)
    .first<{ found: number }>()
  return Boolean(row)
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
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS ahead
       FROM live_leaderboard_entries
       WHERE mode = ? AND challenge_date = ?
         AND (
           won_series > ?
           OR (won_series = ? AND series_wins > ?)
           OR (won_series = ? AND series_wins = ? AND run_diff > ?)
           OR (won_series = ? AND series_wins = ? AND run_diff = ? AND user_runs > ?)
           OR (won_series = ? AND series_wins = ? AND run_diff = ? AND user_runs = ? AND created_at < ?)
         )`,
    )
    .bind(
      entry.mode,
      entry.challengeDate,
      entry.wonSeries ? 1 : 0,
      entry.wonSeries ? 1 : 0,
      entry.seriesWins,
      entry.wonSeries ? 1 : 0,
      entry.seriesWins,
      entry.runDiff,
      entry.wonSeries ? 1 : 0,
      entry.seriesWins,
      entry.runDiff,
      entry.userRuns,
      entry.wonSeries ? 1 : 0,
      entry.seriesWins,
      entry.runDiff,
      entry.userRuns,
      entry.createdAt,
    )
    .first<{ ahead: number }>()

  return (result?.ahead ?? 0) + 1
}
