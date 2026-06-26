import { buildLegendsSnapshotForSim162 } from './classic-live-adapter'
import type { Sim162Snapshot } from '@shared/live/sim162-snapshot'
import { filterSim162PlayersByTeam } from '@shared/live/sim162-snapshot'

export type Sim162Pool = 'live' | 'legends'

export type { Sim162Snapshot }
export { filterSim162PlayersByTeam }

export function buildLegendsSim162Snapshot(): Sim162Snapshot {
  return buildLegendsSnapshotForSim162()
}

export async function fetchSim162Snapshot(
  pool: Sim162Pool,
  challengeDate: string,
): Promise<Sim162Snapshot> {
  if (pool === 'legends') {
    return buildLegendsSnapshotForSim162()
  }
  const params = challengeDate ? `?date=${challengeDate}` : ''
  const response = await fetch(`/api/sim162-live-snapshot${params}`)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Could not load sim162 live snapshot.')
  }
  return (await response.json()) as Sim162Snapshot
}
