import type {
  DailyMatchupSnapshot,
  LiveDraftSnapshot,
  LiveModeId,
  SimulatedSeries,
} from './live-types'
import type { LiveLeaderboardEntryRow } from '../../functions/_lib/live-leaderboard'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from './live-fixtures'
import { challengeDateFromClient, targetDateFromClient } from './live-dates'

export type { LiveLeaderboardEntryRow }

export async function fetchDailyMatchupSnapshot(
  challengeDate?: string,
): Promise<DailyMatchupSnapshot> {
  const date = challengeDate ?? challengeDateFromClient()
  try {
    const params = challengeDate ? `?date=${challengeDate}` : ''
    const response = await fetch(`/api/daily-matchup${params}`)
    if (!response.ok) {
      throw new Error('Could not load Daily Matchup.')
    }
    return (await response.json()) as DailyMatchupSnapshot
  } catch {
    return buildFixtureDailyMatchupSnapshot(date, targetDateFromClient())
  }
}

export async function fetchLiveDraftSnapshot(
  challengeDate?: string,
): Promise<LiveDraftSnapshot> {
  const date = challengeDate ?? challengeDateFromClient()
  try {
    const params = challengeDate ? `?date=${challengeDate}` : ''
    const response = await fetch(`/api/live-draft${params}`)
    if (!response.ok) {
      throw new Error('Could not load Live Draft.')
    }
    return (await response.json()) as LiveDraftSnapshot
  } catch {
    return buildFixtureLiveDraftSnapshot(date)
  }
}

export async function fetchLiveLeaderboard(
  mode: LiveModeId,
  challengeDate: string,
): Promise<{ entries: LiveLeaderboardEntryRow[] }> {
  const params = new URLSearchParams({ mode, date: challengeDate })
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
  lineup: import('./daily-roster').DailyLineup,
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
