import type { LiveModeId, LiveSnapshot } from '../../../shared/live/live-types'
import type { Sim162Snapshot } from '../../../shared/live/sim162-snapshot'
import { targetDate } from '../../../shared/live/live-dates'
import { sim162LiveSnapshotSeed } from '../../../shared/live/seeds'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from '../../../shared/live/live-fixtures'
import { buildDailyMatchupSnapshot } from './daily-matchup-snapshot'
import { buildLiveDraftSnapshot } from './live-draft-snapshot'
import { buildSim162LiveSnapshot } from './sim162-live-snapshot'
import {
  buildSnapshotCacheKey,
  getStoredSnapshot,
  storeSnapshot,
} from './snapshot-cache'

export type ResolveSnapshotEnv = {
  DB?: D1Database
  USE_LIVE_FIXTURES?: string
}

export async function resolveAndCacheSnapshot(
  mode: LiveModeId,
  challengeDate: string,
  env: ResolveSnapshotEnv,
): Promise<LiveSnapshot> {
  const db = env.DB
  const key = buildSnapshotCacheKey(mode, challengeDate)

  if (db) {
    const stored = await getStoredSnapshot(db, key)
    if (stored) {
      return JSON.parse(stored) as LiveSnapshot
    }
  }

  const snapshot = await buildSnapshotForMode(mode, challengeDate, env)

  if (db) {
    await storeSnapshot(db, key, JSON.stringify(snapshot))
  }

  return snapshot
}

async function buildSnapshotForMode(
  mode: LiveModeId,
  challengeDate: string,
  env: ResolveSnapshotEnv,
): Promise<LiveSnapshot> {
  if (env.USE_LIVE_FIXTURES === 'true') {
    if (mode === 'daily-matchup') {
      return buildFixtureDailyMatchupSnapshot(challengeDate, targetDate())
    }
    return buildFixtureLiveDraftSnapshot(challengeDate)
  }

  if (mode === 'daily-matchup') {
    return buildDailyMatchupSnapshot(challengeDate, targetDate())
  }
  return buildLiveDraftSnapshot(challengeDate)
}

/**
 * Same resolve-and-cache seam as resolveAndCacheSnapshot, for the Sim 162
 * live pool. It shares its player pool with the live-draft snapshot but
 * carries its own seed, so it is cached under its own key.
 */
export async function resolveSim162LiveSnapshot(
  challengeDate: string,
  env: ResolveSnapshotEnv,
): Promise<Sim162Snapshot> {
  const db = env.DB
  const key = buildSnapshotCacheKey('sim162-live', challengeDate)

  if (db) {
    const stored = await getStoredSnapshot(db, key)
    if (stored) {
      return JSON.parse(stored) as Sim162Snapshot
    }
  }

  let snapshot: Sim162Snapshot
  if (env.USE_LIVE_FIXTURES === 'true') {
    const draft = buildFixtureLiveDraftSnapshot(challengeDate)
    snapshot = {
      kind: 'sim162-live',
      players: draft.players,
      simSeed: sim162LiveSnapshotSeed(challengeDate),
    }
  } else {
    snapshot = await buildSim162LiveSnapshot(challengeDate)
  }

  if (db) {
    await storeSnapshot(db, key, JSON.stringify(snapshot))
  }

  return snapshot
}
