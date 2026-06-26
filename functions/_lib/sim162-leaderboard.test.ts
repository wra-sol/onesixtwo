import { describe, expect, it } from 'vitest'
import {
  buildSim162LineupKey,
  computeSim162Rank,
  fetchSim162LeaderboardEntries,
  hasSim162SubmissionForIp,
  insertSim162LeaderboardEntry,
  POSTSEASON_RANK,
  SIM162_LEADERBOARD_MAX,
} from './sim162-leaderboard'
import type { PostseasonResult } from '../../shared/live/sim162-season'

type MockResult = {
  first?: unknown
  all?: { results?: unknown[] }
  run?: unknown
}

function createMockDb(
  handler: (query: string, binds: unknown[]) => MockResult,
): D1Database {
  const prepare = (query: string): D1PreparedStatement => {
    let binds: unknown[] = []
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        binds = values
        return stmt
      },
      first<T = unknown>(): Promise<T | null> {
        return Promise.resolve((handler(query, binds).first ?? null) as T | null)
      },
      all<T = unknown>(): Promise<{ results?: T[] }> {
        return Promise.resolve(
          (handler(query, binds).all ?? { results: [] }) as { results?: T[] },
        )
      },
      run(): Promise<unknown> {
        return Promise.resolve(handler(query, binds).run ?? null)
      },
    }
    return stmt
  }
  return { prepare }
}

const SAMPLE_PAYLOAD = JSON.stringify({
  pool: 'live',
  challengeDate: '2026-06-25',
  playerIds: Array.from({ length: 25 }, (_, i) => `p${i}`),
  battingOrderIds: Array.from({ length: 9 }, (_, i) => `b${i}`),
  rotationOrderIds: Array.from({ length: 5 }, (_, i) => `r${i}`),
  simSeed: 'test-seed',
  initials: 'ABC',
})

describe('sim162-leaderboard helpers', () => {
  it('SIM162_LEADERBOARD_MAX is 50', () => {
    expect(SIM162_LEADERBOARD_MAX).toBe(50)
  })

  it('buildSim162LineupKey sorts player ids and prefixes pool', () => {
    const key = buildSim162LineupKey('live', ['p3', 'p1', 'p2'])
    expect(key).toBe('live:p1,p2,p3')
  })

  it('POSTSEASON_RANK maps champs to the highest rank', () => {
    expect(POSTSEASON_RANK['ws-champs']).toBe(6)
    expect(POSTSEASON_RANK['missed']).toBe(1)
    expect(POSTSEASON_RANK['ws-champs']).toBeGreaterThan(
      POSTSEASON_RANK['ws-runner-up'],
    )
  })

  it('fetchSim162LeaderboardEntries maps and enriches rows', async () => {
    const db = createMockDb(() => ({
      all: {
        results: [
          {
            initials: 'ABC',
            pool: 'live',
            wins: 95,
            losses: 67,
            postseason_result: 'lcs' as PostseasonResult,
            won_world_series: 0,
            user_qualified: 1,
            created_at: 1000,
            payload_json: SAMPLE_PAYLOAD,
          },
        ],
      },
    }))

    const entries = await fetchSim162LeaderboardEntries(db, 50)
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry.initials).toBe('ABC')
    expect(entry.pool).toBe('live')
    expect(entry.wins).toBe(95)
    expect(entry.losses).toBe(67)
    expect(entry.postseasonResult).toBe('lcs')
    expect(entry.wonWorldSeries).toBe(false)
    expect(entry.userQualified).toBe(true)
    expect(entry.sharePath).toMatch(/^\/sim162-share\?/)
  })

  it('fetchSim162LeaderboardEntries handles invalid payload_json gracefully', async () => {
    const db = createMockDb(() => ({
      all: {
        results: [
          {
            initials: 'XYZ',
            pool: 'legends',
            wins: 110,
            losses: 52,
            postseason_result: 'ws-champs' as PostseasonResult,
            won_world_series: 1,
            user_qualified: 1,
            created_at: 2000,
            payload_json: 'not-json',
          },
        ],
      },
    }))

    const entries = await fetchSim162LeaderboardEntries(db, 50)
    expect(entries[0]!.sharePath).toBe('')
    expect(entries[0]!.wonWorldSeries).toBe(true)
  })

  it('hasSim162SubmissionForIp returns true when a row exists', async () => {
    const db = createMockDb(() => ({ first: { found: 1 } }))
    const result = await hasSim162SubmissionForIp(db, '1.2.3.4')
    expect(result).toBe(true)
  })

  it('hasSim162SubmissionForIp returns false when no row exists', async () => {
    const db = createMockDb(() => ({ first: null }))
    const result = await hasSim162SubmissionForIp(db, '1.2.3.4')
    expect(result).toBe(false)
  })

  it('insertSim162LeaderboardEntry calls run without throwing', async () => {
    let runCalled = false
    const db = createMockDb(() => {
      runCalled = true
      return { run: undefined }
    })

    await insertSim162LeaderboardEntry(db, {
      id: 'test-id',
      pool: 'live',
      initials: 'ABC',
      wins: 95,
      losses: 67,
      postseasonResult: 'lcs',
      postseasonRank: POSTSEASON_RANK['lcs'],
      wonWorldSeries: false,
      userQualified: true,
      lineupKey: 'live:p1,p2',
      payloadJson: SAMPLE_PAYLOAD,
      submitterIp: '1.2.3.4',
      createdAt: 1000,
    })
    expect(runCalled).toBe(true)
  })

  it('computeSim162Rank returns ahead count + 1', async () => {
    const db = createMockDb(() => ({ first: { ahead: 3 } }))
    const rank = await computeSim162Rank(db, {
      wonWorldSeries: false,
      wins: 95,
      postseasonRank: 4,
      createdAt: 1000,
    })
    expect(rank).toBe(4)
  })

  it('computeSim162Rank returns 1 when no entries are ahead', async () => {
    const db = createMockDb(() => ({ first: { ahead: 0 } }))
    const rank = await computeSim162Rank(db, {
      wonWorldSeries: true,
      wins: 110,
      postseasonRank: 6,
      createdAt: 1000,
    })
    expect(rank).toBe(1)
  })
})
