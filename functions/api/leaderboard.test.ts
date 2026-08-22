import { beforeEach, describe, expect, it } from 'vitest'
import { onRequest } from './leaderboard'
import { createMockDb, type MockQueryHandler } from '../_lib/testing/mock-d1'
import { buildBenchmarkLineup } from '../../src/lib/benchmarks'
import { buildSharePath } from '../../src/lib/share-url'

const lineup = buildBenchmarkLineup('great')
/** Compact share payload ('d=...') for a legal classic lineup. */
const shareQuery = buildSharePath(lineup, 0).split('?')[1]!
const payload = { initials: 'QA', d: new URLSearchParams(shareQuery).get('d') }

function postRequest(body: unknown): Request {
  return new Request('https://site/api/leaderboard', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '9.9.9.9', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

let inserted: Array<{ query: string; binds: unknown[] }> = []

const dbHandler: MockQueryHandler = (query, binds) => {
  if (query.includes('INSERT INTO leaderboard_entries')) {
    inserted.push({ query, binds })
    return {}
  }
  if (query.includes('SELECT COUNT(*) AS count')) {
    return { first: { count: 0 } }
  }
  if (query.includes('SELECT 1 AS found FROM leaderboard_entries')) {
    return { first: null }
  }
  if (query.includes('SELECT COUNT(*) AS ahead')) {
    return { first: { ahead: 0 } }
  }
  if (query.includes('FROM leaderboard_entries')) {
    return { all: { results: [] } }
  }
  return {}
}

beforeEach(() => {
  inserted = []
})

describe('POST /api/leaderboard (classic)', () => {
  it('verifies the share server-side, inserts, and ranks', async () => {
    const response = await onRequest({
      request: postRequest(payload),
      env: { DB: createMockDb(dbHandler) },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; rank: number }
    expect(body.ok).toBe(true)
    expect(body.rank).toBe(1)
    expect(inserted.length).toBe(1)
    // The stored entry carries re-simmed results, not client claims.
    expect(String(inserted[0]!.binds.join(','))).toContain('QA')
  })

  it('rate-limits after ten submissions in a day', async () => {
    const limited: MockQueryHandler = (query, binds) => {
      if (query.includes('SELECT COUNT(*) AS count')) return { first: { count: 10 } }
      return dbHandler(query, binds)
    }
    const response = await onRequest({
      request: postRequest(payload),
      env: { DB: createMockDb(limited) },
    })
    expect(response.status).toBe(429)
    expect(inserted.length).toBe(0)
  })

  it('rejects a duplicate lineup with 409 before inserting', async () => {
    const duped: MockQueryHandler = (query, binds) => {
      if (query.includes('SELECT 1 AS found FROM leaderboard_entries')) {
        return { first: { found: 1 } }
      }
      return dbHandler(query, binds)
    }
    const response = await onRequest({
      request: postRequest(payload),
      env: { DB: createMockDb(duped) },
    })
    expect(response.status).toBe(409)
    expect(inserted.length).toBe(0)
  })

  it('rejects tampered payloads that reference unknown players', async () => {
    const response = await onRequest({
      request: postRequest({ initials: 'QA', d: 'garbage-payload' }),
      env: { DB: createMockDb(dbHandler) },
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(inserted.length).toBe(0)
  })

  it('returns 503 without a D1 binding', async () => {
    const response = await onRequest({ request: postRequest(payload), env: {} })
    expect(response.status).toBe(503)
  })
})
