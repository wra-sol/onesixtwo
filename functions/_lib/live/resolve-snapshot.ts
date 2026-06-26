import type { LiveModeId, LiveSnapshot } from '../../../shared/live/live-types'
import { targetDate } from '../../../shared/live/live-dates'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from '../../../shared/live/live-fixtures'
import { buildDailyMatchupSnapshot } from './daily-matchup-snapshot'
import { buildLiveDraftSnapshot } from './live-draft-snapshot'
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
