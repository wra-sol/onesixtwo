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
import { httpMlbSource } from './mlb-source'
import {
  buildSnapshotCacheKey,
  getStoredSnapshot,
  storeSnapshot,
  type SnapshotKind,
} from './snapshot-cache'

export type ResolveSnapshotEnv = {
  DB?: D1Database
  USE_LIVE_FIXTURES?: string
}

export function fixturesEnabled(env: ResolveSnapshotEnv): boolean {
  return env.USE_LIVE_FIXTURES === 'true'
}

/**
 * The one read-through cache body: cache key → stored snapshot → build →
 * store. Every snapshot kind resolves through this single implementation.
 */
async function readThroughCache<T>(
  kind: SnapshotKind,
  challengeDate: string,
  env: ResolveSnapshotEnv,
  build: () => Promise<T>,
): Promise<T> {
  const db = env.DB
  const key = buildSnapshotCacheKey(kind, challengeDate)

  if (db) {
    const stored = await getStoredSnapshot(db, key)
    if (stored) {
      return JSON.parse(stored) as T
    }
  }

  const snapshot = await build()

  if (db) {
    await storeSnapshot(db, key, JSON.stringify(snapshot))
  }

  return snapshot
}

export function resolveAndCacheSnapshot(
  mode: LiveModeId,
  challengeDate: string,
  env: ResolveSnapshotEnv,
): Promise<LiveSnapshot> {
  return readThroughCache(mode, challengeDate, env, async () => {
    if (fixturesEnabled(env)) {
      if (mode === 'daily-matchup') {
        return buildFixtureDailyMatchupSnapshot(challengeDate, targetDate())
      }
      return buildFixtureLiveDraftSnapshot(challengeDate)
    }

    const source = httpMlbSource()
    if (mode === 'daily-matchup') {
      return buildDailyMatchupSnapshot(challengeDate, targetDate(), source)
    }
    return buildLiveDraftSnapshot(challengeDate, source)
  })
}

/**
 * Same resolve-and-cache seam as resolveAndCacheSnapshot, for the Sim 162
 * live pool. It shares its player pool with the live-draft snapshot but
 * carries its own seed, so it is cached under its own key.
 */
export function resolveSim162LiveSnapshot(
  challengeDate: string,
  env: ResolveSnapshotEnv,
): Promise<Sim162Snapshot> {
  return readThroughCache('sim162-live', challengeDate, env, async () => {
    if (fixturesEnabled(env)) {
      const draft = buildFixtureLiveDraftSnapshot(challengeDate)
      return {
        kind: 'sim162-live',
        players: draft.players,
        simSeed: sim162LiveSnapshotSeed(challengeDate),
      }
    }
    return buildSim162LiveSnapshot(challengeDate, httpMlbSource())
  })
}
