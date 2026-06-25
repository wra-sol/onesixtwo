import type {
  DailyMatchupSnapshot,
  LiveDraftSnapshot,
  LiveLeaderboardEntryRow,
  LiveModeId,
  SimulatedSeries,
} from '@shared/live/live-types'
import { challengeDate, targetDate } from '@shared/live/live-dates'

export type { LiveLeaderboardEntryRow }

export class LiveSnapshotError extends Error {
  fallback?: boolean

  constructor(message: string, fallback?: boolean) {
    super(message)
    this.name = 'LiveSnapshotError'
    this.fallback = fallback
  }
}

async function parseSnapshotResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { fallback?: boolean; error?: string }
  if (!response.ok) {
    throw new LiveSnapshotError(
      typeof body === 'object' && body && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Could not load live snapshot.',
    )
  }
  if (
    typeof body === 'object' &&
    body &&
    'fallback' in body &&
    body.fallback === true
  ) {
    throw new LiveSnapshotError(
      body.error ?? 'Live mode is temporarily unavailable.',
      true,
    )
  }
  return body
}

export async function fetchDailyMatchupSnapshot(
  challengeDateParam?: string,
): Promise<DailyMatchupSnapshot> {
  const params = challengeDateParam ? `?date=${challengeDateParam}` : ''
  const response = await fetch(`/api/daily-matchup${params}`)
  return parseSnapshotResponse<DailyMatchupSnapshot>(response)
}

export async function fetchLiveDraftSnapshot(
  challengeDateParam?: string,
): Promise<LiveDraftSnapshot> {
  const params = challengeDateParam ? `?date=${challengeDateParam}` : ''
  const response = await fetch(`/api/live-draft${params}`)
  return parseSnapshotResponse<LiveDraftSnapshot>(response)
}

export async function fetchLiveLeaderboard(
  mode: LiveModeId,
  challengeDateParam: string,
): Promise<{ entries: LiveLeaderboardEntryRow[] }> {
  const params = new URLSearchParams({ mode, date: challengeDateParam })
  const response = await fetch(`/api/live-leaderboard?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Could not load live leaderboard.')
  }
  return (await response.json()) as { entries: LiveLeaderboardEntryRow[] }
}

export type LiveSubmitResult =
  | { ok: true; rank: number; series: SimulatedSeries; ranked: true }
  | { ok: false; error: string; series?: SimulatedSeries; ranked?: false }

export async function submitLiveLeaderboard(input: {
  mode: LiveModeId
  challengeDate: string
  targetDate?: string
  initials: string
  playerIds: string[]
  battingOrderIds: string[]
  aiPlayerIds?: string[]
  simSeed: string
}): Promise<LiveSubmitResult> {
  const response = await fetch('/api/live-leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await response.json().catch(() => null)) as LiveSubmitResult | null
  if (!body) {
    return { ok: false, error: 'Could not submit to leaderboard.' }
  }
  return body
}

export function lineupPlayerIdsFromDailyLineup(
  lineup: import('@shared/live/daily-roster').DailyLineup,
): string[] {
  const positions = [
    'C',
    '1B',
    '2B',
    '3B',
    'SS',
    'OF1',
    'OF2',
    'OF3',
    'DH',
    'SP',
    'RP',
    'CL',
  ] as const
  return positions.map((pos) => lineup[pos]?.id ?? '')
}

export { challengeDate, targetDate }
