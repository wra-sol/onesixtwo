import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchDailyMatchupSnapshot,
  LiveSnapshotError,
} from './live-api-client'
import type { DailyMatchupSnapshot } from '@shared/live/live-types'

function snapshotResponse(overrides: Partial<DailyMatchupSnapshot> = {}): DailyMatchupSnapshot {
  return {
    kind: 'daily-matchup',
    challengeDate: '2026-06-25',
    targetDate: '2026-06-24',
    available: true,
    opponent: null,
    opponentGameScore: { runs: 5, hits: 9, runDiff: 2 },
    players: [],
    simSeed: 'seed',
    ...overrides,
  }
}

describe('live-api-client — parseSnapshotResponse', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a fallback body instead of throwing (playable fallback)', async () => {
    const body = snapshotResponse({ fallback: true, error: 'MLB API down' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const result = await fetchDailyMatchupSnapshot('2026-06-25')
    expect(result.fallback).toBe(true)
    expect(result.error).toBe('MLB API down')
    expect(result.available).toBe(true)
  })

  it('throws LiveSnapshotError on a hard HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Snapshot build failed' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    await expect(fetchDailyMatchupSnapshot('2026-06-25')).rejects.toSatisfy((err) => {
      return err instanceof LiveSnapshotError && err.message === 'Snapshot build failed'
    })
  })

  it('returns a normal (non-fallback) snapshot unchanged', async () => {
    const body = snapshotResponse()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const result = await fetchDailyMatchupSnapshot('2026-06-25')
    expect(result.fallback).toBeUndefined()
    expect(result.challengeDate).toBe('2026-06-25')
  })
})
