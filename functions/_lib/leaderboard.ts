/// <reference path="./d1.d.ts" />
import {
  buildSharePathFromParsed,
  isParsedShare,
  parseShareParams,
} from '../../src/lib/share-url'
import type { RosterFormatId } from '../../src/lib/types'

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all'

export type LeaderboardEntryRow = {
  initials: string
  wins: number
  losses: number
  teamScore: number
  isPerfectSeason: boolean
  rosterFormatId: RosterFormatId
  sharePath: string
  createdAt: number
}

export type SubmitPayload = {
  initials: string
  playerIds: string[]
  rosterFormatId: RosterFormatId
  reroll: number
}

export type SubmitValidationError =
  | 'invalid_json'
  | 'invalid_initials'
  | 'missing_players'
  | 'invalid_reroll'
  | 'reroll_not_allowed'
  | 'invalid_share'

export const SUBMIT_ERROR_MESSAGES: Record<SubmitValidationError, string> = {
  invalid_json: 'Invalid request body.',
  invalid_initials: 'Enter 2–3 letters (A–Z).',
  missing_players: 'This lineup cannot be submitted.',
  invalid_reroll: 'Invalid reroll value.',
  reroll_not_allowed: 'Only your first simulation can be submitted.',
  invalid_share: 'This lineup could not be verified.',
}

export const INITIALS_PATTERN = /^[A-Z]{2,3}$/

export function normalizeInitials(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (!INITIALS_PATTERN.test(normalized)) return null
  return normalized
}

export function parseLeaderboardPeriod(
  raw: string | null,
): LeaderboardPeriod | null {
  if (raw === 'daily' || raw === 'weekly' || raw === 'all') return raw
  return null
}

export const LEADERBOARD_MAX_ENTRIES = 30

export function parseLimit(raw: string | null, fallback = LEADERBOARD_MAX_ENTRIES): number {
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.min(value, LEADERBOARD_MAX_ENTRIES)
}

/** UTC midnight for the current day. */
export function startOfUtcDayMs(now = Date.now()): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** UTC Monday 00:00 for the current ISO week. */
export function startOfUtcWeekMs(now = Date.now()): number {
  const date = new Date(now)
  const day = date.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - diff,
    ),
  )
  return monday.getTime()
}

export function periodStartMs(
  period: LeaderboardPeriod,
  now = Date.now(),
): number | null {
  switch (period) {
    case 'daily':
      return startOfUtcDayMs(now)
    case 'weekly':
      return startOfUtcWeekMs(now)
    case 'all':
      return null
  }
}

export function buildLineupKey(
  playerIds: readonly string[],
  rosterFormatId: RosterFormatId,
): string {
  return `${rosterFormatId}:${playerIds.join(',')}`
}

export { buildSharePathFromParsed as buildSharePath }

export function parseSubmitPayload(
  body: unknown,
): SubmitPayload | SubmitValidationError {
  if (!body || typeof body !== 'object') return 'invalid_json'

  const record = body as Record<string, unknown>
  const initials = normalizeInitials(record.initials)
  if (!initials) return 'invalid_initials'

  const params = new URLSearchParams()
  if (typeof record.d === 'string' && record.d.trim()) {
    params.set('d', record.d.trim())
  }
  if (typeof record.p === 'string' && record.p.trim()) {
    params.set('p', record.p.trim())
  }
  if (typeof record.f === 'string' && record.f.trim()) {
    params.set('f', record.f.trim())
  }

  if (record.n !== undefined && record.n !== null && record.n !== '') {
    if (typeof record.n === 'number') {
      if (!Number.isFinite(record.n) || record.n < 0) return 'invalid_reroll'
      if (record.n > 0) params.set('n', String(record.n))
    } else if (typeof record.n === 'string') {
      if (!/^\d+$/.test(record.n)) return 'invalid_reroll'
      const reroll = Number.parseInt(record.n, 10)
      if (!Number.isFinite(reroll) || reroll < 0) return 'invalid_reroll'
      if (reroll > 0) params.set('n', record.n)
    } else {
      return 'invalid_reroll'
    }
  }

  if (!params.get('d') && !params.get('p')) {
    return 'missing_players'
  }

  const parsed = parseShareParams(params)
  if (!isParsedShare(parsed)) return 'invalid_share'
  if (parsed.reroll > 0) return 'reroll_not_allowed'

  return {
    initials,
    playerIds: parsed.playerIds,
    rosterFormatId: parsed.rosterFormatId,
    reroll: parsed.reroll,
  }
}

export function compareLeaderboardRows(
  a: Pick<
    LeaderboardEntryRow,
    'wins' | 'losses' | 'teamScore' | 'createdAt'
  >,
  b: Pick<
    LeaderboardEntryRow,
    'wins' | 'losses' | 'teamScore' | 'createdAt'
  >,
): number {
  if (a.wins !== b.wins) return b.wins - a.wins
  if (a.losses !== b.losses) return a.losses - b.losses
  if (a.teamScore !== b.teamScore) return b.teamScore - a.teamScore
  return a.createdAt - b.createdAt
}

export function rankForEntry(
  entry: Pick<
    LeaderboardEntryRow,
    'wins' | 'losses' | 'teamScore' | 'createdAt'
  >,
  entries: Array<
    Pick<LeaderboardEntryRow, 'wins' | 'losses' | 'teamScore' | 'createdAt'>
  >,
): number {
  let rank = 1
  for (const other of entries) {
    if (compareLeaderboardRows(entry, other) > 0) {
      rank += 1
    }
  }
  return rank
}

type DbRow = {
  initials: string
  wins: number
  losses: number
  team_score: number
  is_perfect: number
  roster_format_id: RosterFormatId
  share_path: string
  created_at: number
}

export function mapDbRow(row: DbRow): LeaderboardEntryRow {
  return {
    initials: row.initials,
    wins: row.wins,
    losses: row.losses,
    teamScore: row.team_score,
    isPerfectSeason: row.is_perfect === 1,
    rosterFormatId: row.roster_format_id,
    sharePath: row.share_path,
    createdAt: row.created_at,
  }
}

export const RATE_LIMIT_PER_DAY = 10

export async function countSubmissionsSince(
  db: D1Database,
  submitterIp: string,
  sinceMs: number,
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM leaderboard_entries
       WHERE submitter_ip = ? AND created_at >= ?`,
    )
    .bind(submitterIp, sinceMs)
    .first<{ count: number }>()
  return result?.count ?? 0
}

export async function hasLineupInPeriod(
  db: D1Database,
  lineupKey: string,
  sinceMs: number | null,
): Promise<boolean> {
  const query =
    sinceMs === null
      ? `SELECT 1 AS found FROM leaderboard_entries WHERE lineup_key = ? LIMIT 1`
      : `SELECT 1 AS found FROM leaderboard_entries
         WHERE lineup_key = ? AND created_at >= ? LIMIT 1`

  const statement =
    sinceMs === null
      ? db.prepare(query).bind(lineupKey)
      : db.prepare(query).bind(lineupKey, sinceMs)

  const result = await statement.first<{ found: number }>()
  return Boolean(result)
}

export async function fetchLeaderboardEntries(
  db: D1Database,
  period: LeaderboardPeriod,
  limit: number,
  now = Date.now(),
): Promise<LeaderboardEntryRow[]> {
  const sinceMs = periodStartMs(period, now)
  const query =
    sinceMs === null
      ? `SELECT initials, wins, losses, team_score, is_perfect,
                roster_format_id, share_path, created_at
         FROM leaderboard_entries
         ORDER BY wins DESC, losses ASC, team_score DESC, created_at ASC
         LIMIT ?`
      : `SELECT initials, wins, losses, team_score, is_perfect,
                roster_format_id, share_path, created_at
         FROM leaderboard_entries
         WHERE created_at >= ?
         ORDER BY wins DESC, losses ASC, team_score DESC, created_at ASC
         LIMIT ?`

  const statement =
    sinceMs === null
      ? db.prepare(query).bind(limit)
      : db.prepare(query).bind(sinceMs, limit)

  const { results } = await statement.all<DbRow>()
  return (results ?? []).map(mapDbRow)
}

export async function insertLeaderboardEntry(
  db: D1Database,
  input: {
    id: string
    initials: string
    wins: number
    losses: number
    teamScore: number
    isPerfectSeason: boolean
    rosterFormatId: RosterFormatId
    lineupKey: string
    sharePath: string
    submitterIp: string
    createdAt: number
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO leaderboard_entries (
         id, initials, wins, losses, team_score, is_perfect,
         roster_format_id, lineup_key, share_path, submitter_ip, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.initials,
      input.wins,
      input.losses,
      input.teamScore,
      input.isPerfectSeason ? 1 : 0,
      input.rosterFormatId,
      input.lineupKey,
      input.sharePath,
      input.submitterIp,
      input.createdAt,
    )
    .run()
}

export async function computeDailyRank(
  db: D1Database,
  entry: Pick<
    LeaderboardEntryRow,
    'wins' | 'losses' | 'teamScore' | 'createdAt'
  >,
  now = Date.now(),
): Promise<number> {
  const sinceMs = startOfUtcDayMs(now)
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS ahead
       FROM leaderboard_entries
       WHERE created_at >= ?
         AND (
           wins > ?
           OR (wins = ? AND losses < ?)
           OR (wins = ? AND losses = ? AND team_score > ?)
           OR (wins = ? AND losses = ? AND team_score = ? AND created_at < ?)
         )`,
    )
    .bind(
      sinceMs,
      entry.wins,
      entry.wins,
      entry.losses,
      entry.wins,
      entry.losses,
      entry.teamScore,
      entry.wins,
      entry.losses,
      entry.teamScore,
      entry.createdAt,
    )
    .first<{ ahead: number }>()

  return (result?.ahead ?? 0) + 1
}
