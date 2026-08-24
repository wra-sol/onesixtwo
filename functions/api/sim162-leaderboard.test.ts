import { describe, expect, it, beforeEach } from 'vitest'
import { onRequest } from './sim162-leaderboard'
import { createMockDb } from '../_lib/testing/mock-d1'
import type { MockQueryHandler } from '../_lib/testing/mock-d1'
import {
  autoFillRemaining,
  createSim162DraftState,
} from '../../shared/live/sim162-draft'
import {
  roster25BattingOrder,
  roster25Rotation,
  roster25ToPlayerIds,
} from '../../shared/live/roster25'
import { heuristicAiBattingOrder } from '../../shared/live/live-draft'
import { buildLegendsSnapshotForSim162 } from '../../src/lib/classic-live-adapter'

const DATE = '2026-06-25'

function legalSubmission() {
  // The legends pool ships in the function bundle, so this endpoint test
  // exercises the full server-side verification path (one season re-sim).
  const snapshot = buildLegendsSnapshotForSim162()
  let state = createSim162DraftState(snapshot.players)
  state = autoFillRemaining(state)
  return {
    pool: 'legends' as const,
    challengeDate: DATE,
    playerIds: roster25ToPlayerIds(state.roster),
    battingOrderIds: heuristicAiBattingOrder(
      roster25BattingOrder(state.roster),
    ).map((p) => p.id),
    rotationOrderIds: roster25Rotation(state.roster).map((p) => p.id),
    initials: 'TST',
    simSeed: 'client-claimed-seed',
  }
}

function postRequest(body: unknown): Request {
  return new Request('https://site/api/sim162-leaderboard', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '9.9.9.9', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

let inserted: Array<{ binds: unknown[] }> = []

beforeEach(() => {
  inserted = []
})

const dbHandler: MockQueryHandler = (query, binds) => {
  if (query.includes('SELECT 1 AS found FROM sim162_leaderboard_entries')) {
    return { first: null } // no prior submission for this IP
  }
  if (query.includes('INSERT INTO sim162_leaderboard_entries')) {
    inserted.push({ binds })
    return {}
  }
  if (query.includes('SELECT COUNT(*)')) {
    return { first: { ahead: 0 } }
  }
  if (query.includes('FROM sim162_leaderboard_entries')) {
    return { all: { results: [] } }
  }
  if (query.includes('FROM live_snapshots')) {
    return { first: null }
  }
  return {}
}

describe('POST /api/sim162-leaderboard', () => {
  it('verifies a full season server-side, inserts, and ranks', async () => {
    const response = await onRequest({
      request: postRequest(legalSubmission()),
      env: { DB: createMockDb(dbHandler) },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      ok: boolean
      rank: number
      ranked: boolean
      record: { wins: number; losses: number }
    }
    expect(body.ok).toBe(true)
    expect(body.rank).toBe(1)
    expect(body.ranked).toBe(true)
    expect(body.record.wins + body.record.losses).toBe(162)
    expect(inserted.length).toBe(1)

    // Stored values are server-derived: initials ride along, claimed seed does not.
    const stored = JSON.parse(String(inserted[0]!.binds[10])) as { simSeed?: string }
    expect(String(inserted[0]!.binds.join(','))).toContain('TST')
    expect(stored.simSeed).toBeTruthy()
    expect(stored.simSeed).not.toBe('client-claimed-seed')
  }, 30_000)

  it('rejects a second submission from the same IP before verifying', async () => {
    const dupHandler: MockQueryHandler = (query, binds) => {
      if (query.includes('SELECT 1 AS found FROM sim162_leaderboard_entries')) {
        return { first: { found: 1 } }
      }
      return dbHandler(query, binds)
    }
    const response = await onRequest({
      request: postRequest(legalSubmission()),
      env: { DB: createMockDb(dupHandler) },
    })
    expect(response.status).toBe(409)
    expect(inserted.length).toBe(0)
  })

  it('rejects rosters with players outside the pool', async () => {
    const payload = legalSubmission()
    payload.playerIds[0] = 'not-in-pool'
    const response = await onRequest({
      request: postRequest(payload),
      env: { DB: createMockDb(dbHandler) },
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/outside the pool/i)
    expect(inserted.length).toBe(0)
  })

  it('rejects structurally invalid payloads', async () => {
    const payload = legalSubmission()
    ;(payload as Record<string, unknown>).pool = 'nope'
    const response = await onRequest({
      request: postRequest(payload),
      env: { DB: createMockDb(dbHandler) },
    })
    expect(response.status).toBe(400)
    expect(inserted.length).toBe(0)
  })

  it('returns 503 when the D1 binding is missing', async () => {
    const response = await onRequest({
      request: postRequest(legalSubmission()),
      env: {},
    })
    expect(response.status).toBe(503)
  })
})

describe('GET /api/sim162-leaderboard', () => {
  it('returns stored entries', async () => {
    const row = {
      initials: 'ABC',
      pool: 'live',
      wins: 95,
      losses: 67,
      postseason_result: 'lcs',
      won_world_series: 0,
      user_qualified: 1,
      created_at: 1000,
      payload_json: JSON.stringify(legalSubmission()),
    }
    const getHandler: MockQueryHandler = (query) => {
      if (query.includes('FROM sim162_leaderboard_entries')) {
        return { all: { results: [row] } }
      }
      return {}
    }
    const response = await onRequest({
      request: new Request('https://site/api/sim162-leaderboard'),
      env: { DB: createMockDb(getHandler) },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { entries: Array<{ initials: string }> }
    expect(body.entries.length).toBe(1)
    expect(body.entries[0]!.initials).toBe('ABC')
  })
})
