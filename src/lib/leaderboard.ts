import {
  normalizeInitials,
  type LeaderboardEntryRow,
  type LeaderboardPeriod,
} from '../../functions/_lib/leaderboard'
import type { GameModeId } from './types'

export type { LeaderboardEntryRow, LeaderboardPeriod }

export const LEADERBOARD_MAX_ENTRIES = 30

export type LeaderboardResponse = {
  period: LeaderboardPeriod
  mode: GameModeId
  entries: LeaderboardEntryRow[]
}

export type SubmitLeaderboardSuccess = {
  ok: true
  rank: number
  period: 'daily'
  mode: GameModeId
}

export type SubmitLeaderboardFailure = {
  ok: false
  error: string
}

export type SubmitLeaderboardResult =
  | SubmitLeaderboardSuccess
  | SubmitLeaderboardFailure

export const INITIALS_STORAGE_KEY = 'ps-initials'

export { normalizeInitials }

export function validateInitials(raw: string): string | null {
  return normalizeInitials(raw)
}

export function readStoredInitials(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(INITIALS_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeStoredInitials(initials: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(INITIALS_STORAGE_KEY, initials)
  } catch {
    // ignore quota / private mode
  }
}

export function sharePathToSubmitPayload(sharePath: string): {
  d?: string
  p?: string
  f?: string
  m?: string
  n?: number
} {
  const query = sharePath.includes('?')
    ? sharePath.split('?')[1]!
    : sharePath
  const params = new URLSearchParams(query)
  const payload: {
    d?: string
    p?: string
    f?: string
    m?: string
    n?: number
  } = {}
  const compact = params.get('d')
  const legacy = params.get('p')
  if (compact) payload.d = compact
  if (legacy) payload.p = legacy
  const format = params.get('f')
  if (format) payload.f = format
  const mode = params.get('m')
  if (mode) payload.m = mode
  const reroll = params.get('n')
  if (reroll) payload.n = Number.parseInt(reroll, 10)
  return payload
}

export async function fetchLeaderboard(
  period: LeaderboardPeriod,
  limit = LEADERBOARD_MAX_ENTRIES,
  mode: GameModeId = 'all-time',
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    period,
    limit: String(limit),
    mode,
  })
  const response = await fetch(`/api/leaderboard?${params.toString()}`)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null
    throw new Error(body?.error ?? 'Could not load leaderboard.')
  }
  return (await response.json()) as LeaderboardResponse
}

export async function submitToLeaderboard(input: {
  initials: string
  sharePath: string
}): Promise<SubmitLeaderboardResult> {
  const normalized = normalizeInitials(input.initials)
  if (!normalized) {
    return { ok: false, error: 'Enter 2–3 letters (A–Z).' }
  }

  const sharePayload = sharePathToSubmitPayload(input.sharePath)
  if (!sharePayload.d && !sharePayload.p) {
    return { ok: false, error: 'This lineup cannot be submitted.' }
  }

  const response = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initials: normalized,
      ...sharePayload,
    }),
  })

  const body = (await response.json().catch(() => null)) as
    | SubmitLeaderboardResult
    | null

  if (!body) {
    return { ok: false, error: 'Could not submit to leaderboard.' }
  }

  if (!response.ok && body.ok === false) {
    return body
  }

  if (body.ok) {
    writeStoredInitials(normalized)
    return body
  }

  return { ok: false, error: 'Could not submit to leaderboard.' }
}

export const LEADERBOARD_PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
  all: 'All time',
}
