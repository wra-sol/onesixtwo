import { describe, expect, it, vi } from 'vitest'
import type { LiveModeId } from '../../../shared/live/live-types'
import {
  buildSnapshotCacheKey,
  getStoredSnapshot,
  SNAPSHOT_CACHE_VERSION,
  storeSnapshot,
} from './snapshot-cache'

function createMockDb(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))

  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (!sql.includes('SELECT')) return null
          const key = args[0] as string
          const payload = store.get(key)
          return payload ? { payload } : null
        },
        run: async () => {
          if (sql.includes('INSERT')) {
            const [key, payload] = args as [string, string]
            store.set(key, payload)
          }
        },
      }),
    }),
    store,
  } as unknown as D1Database & { store: Map<string, string> }
}

describe('buildSnapshotCacheKey', () => {
  it('includes version prefix for both modes', () => {
    expect(buildSnapshotCacheKey('daily-matchup', '2026-06-25')).toBe(
      `daily-matchup:${SNAPSHOT_CACHE_VERSION}:2026-06-25`,
    )
    expect(buildSnapshotCacheKey('live-draft', '2026-06-25')).toBe(
      `live-draft:${SNAPSHOT_CACHE_VERSION}:2026-06-25`,
    )
  })

  it('matches keys used by snapshot API and leaderboard resolver', () => {
    const modes: LiveModeId[] = ['daily-matchup', 'live-draft']
    for (const mode of modes) {
      const apiKey = `${mode}:${SNAPSHOT_CACHE_VERSION}:2026-06-25`
      expect(buildSnapshotCacheKey(mode, '2026-06-25')).toBe(apiKey)
    }
  })
})

describe('snapshot cache read/write', () => {
  it('returns null on cache miss', async () => {
    const db = createMockDb()
    await expect(getStoredSnapshot(db, 'daily-matchup:v2:2026-06-25')).resolves.toBeNull()
  })

  it('reads stored payload after write', async () => {
    const db = createMockDb()
    const key = buildSnapshotCacheKey('daily-matchup', '2026-06-25')
    const payload = JSON.stringify({ kind: 'daily-matchup' })

    await storeSnapshot(db, key, payload)
    await expect(getStoredSnapshot(db, key)).resolves.toBe(payload)
  })

  it('upserts payload for the same key', async () => {
    const db = createMockDb()
    const key = buildSnapshotCacheKey('live-draft', '2026-06-25')

    await storeSnapshot(db, key, JSON.stringify({ version: 1 }))
    await storeSnapshot(db, key, JSON.stringify({ version: 2 }))

    await expect(getStoredSnapshot(db, key)).resolves.toBe(JSON.stringify({ version: 2 }))
    expect(db.store.size).toBe(1)
  })

  it('warns and returns null when read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            throw new Error('D1 unavailable')
          },
        }),
      }),
    } as unknown as D1Database

    await expect(getStoredSnapshot(db, 'daily-matchup:v2:2026-06-25')).resolves.toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
