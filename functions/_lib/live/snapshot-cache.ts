import type { LiveModeId } from '../../../shared/live/live-types'

/** Bump when snapshot shape or live-vs-fixture semantics change (invalidates D1 cache). */
export const SNAPSHOT_CACHE_VERSION = 'v2'

/**
 * Snapshot kinds that get their own versioned D1 cache entry. 'sim162-live'
 * shares its player pool with 'live-draft' but carries a different seed, so
 * it is cached separately rather than rebuilt uncached per request.
 */
export type SnapshotKind = LiveModeId | 'sim162-live'

export function buildSnapshotCacheKey(
  kind: SnapshotKind,
  challengeDate: string,
): string {
  return `${kind}:${SNAPSHOT_CACHE_VERSION}:${challengeDate}`
}

export async function getStoredSnapshot(
  db: D1Database,
  key: string,
): Promise<string | null> {
  try {
    const row = await db
      .prepare('SELECT payload FROM live_snapshots WHERE snapshot_key = ?')
      .bind(key)
      .first<{ payload: string }>()
    return row?.payload ?? null
  } catch (error) {
    console.warn(
      'live_snapshots read failed',
      key,
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

export async function storeSnapshot(
  db: D1Database,
  key: string,
  payload: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO live_snapshots (snapshot_key, payload, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(snapshot_key) DO UPDATE SET
           payload = excluded.payload,
           created_at = excluded.created_at`,
      )
      .bind(key, payload, Date.now())
      .run()
  } catch (error) {
    console.warn(
      'live_snapshots write failed',
      key,
      error instanceof Error ? error.message : error,
    )
  }
}
