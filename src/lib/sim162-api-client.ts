import type { PostseasonResult } from '@shared/live/sim162-season'
import type { Sim162LeaderboardEntryRow, Sim162Pool } from '../../functions/_lib/sim162-leaderboard'

export type { Sim162LeaderboardEntryRow, Sim162Pool }

export type Sim162SubmitPayload = {
  pool: Sim162Pool
  initials: string
  challengeDate: string
  playerIds: string[]
  battingOrderIds: string[]
  rotationOrderIds: string[]
  simSeed: string
  wins: number
  losses: number
  postseasonResult: PostseasonResult
  wonWorldSeries: boolean
  userQualified: boolean
}

export type Sim162SubmitResult =
  | { ok: true; rank: number; ranked: true }
  | { ok: false; error: string; ranked?: false }

export async function fetchSim162Leaderboard(): Promise<{
  entries: Sim162LeaderboardEntryRow[]
}> {
  const response = await fetch('/api/sim162-leaderboard')
  if (!response.ok) {
    throw new Error('Could not load Sim 162 leaderboard.')
  }
  return (await response.json()) as { entries: Sim162LeaderboardEntryRow[] }
}

export async function submitSim162Leaderboard(
  payload: Sim162SubmitPayload,
): Promise<Sim162SubmitResult> {
  const response = await fetch('/api/sim162-leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await response.json().catch(() => null)) as Sim162SubmitResult | null
  if (!body) {
    return { ok: false, error: 'Could not submit to leaderboard.' }
  }
  return body
}
