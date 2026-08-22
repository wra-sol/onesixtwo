import { beforeEach, describe, expect, it } from 'vitest'
import { onRequest } from './live-leaderboard'
import { createMockDb } from '../_lib/testing/mock-d1'
import type { MockQueryHandler } from '../_lib/testing/mock-d1'
import { buildFixtureLiveDraftSnapshot } from '../../shared/live/live-fixtures'
import { playerEligibleForDailyPosition } from '../../shared/live/daily-roster'
import type { LivePlayer } from '../../shared/live/live-types'

const DATE = '2026-06-25'

function pickLineups(): {
  playerIds: string[]
  battingOrderIds: string[]
  aiPlayerIds: string[]
} {
  const snapshot = buildFixtureLiveDraftSnapshot(DATE)
  const pool = snapshot.players

  const usedGlobal = new Set<string>()

  const user = (() => {
    const lineup: LivePlayer[] = []
    const localTeams = new Set<number>()
    const slots: Array<'C' | '1B' | '2B' | '3B' | 'SS' | 'OF1' | 'OF2' | 'OF3' | 'DH' | 'SP' | 'RP' | 'CL'> = [
      'C', '1B', '2B', '3B', 'SS', 'OF1', 'OF2', 'OF3', 'DH', 'SP', 'RP', 'CL',
    ]
    for (const pos of slots) {
      const pick = pool.find(
        (p) =>
          !usedGlobal.has(p.id) &&
          !localTeams.has(p.teamId) &&
          playerEligibleForDailyPosition(p, pos),
      )
      if (!pick) throw new Error(`fixture pool exhausted at ${pos}`)
      lineup.push(pick)
      usedGlobal.add(pick.id)
      localTeams.add(pick.teamId)
    }
    return {
      ids: lineup.map((p) => p.id),
      order: lineup.slice(0, 9).map((p) => p.id),
    }
  })()

  const ai = (() => {
    const lineup: LivePlayer[] = []
    const localTeams = new Set<number>()
    const slots: Array<'C' | '1B' | '2B' | '3B' | 'SS' | 'OF1' | 'OF2' | 'OF3' | 'DH' | 'SP' | 'RP' | 'CL'> = [
      'C', '1B', '2B', '3B', 'SS', 'OF1', 'OF2', 'OF3', 'DH', 'SP', 'RP', 'CL',
    ]
    for (const pos of slots) {
      const pick = pool.find(
        (p) =>
          !usedGlobal.has(p.id) &&
          !localTeams.has(p.teamId) &&
          playerEligibleForDailyPosition(p, pos),
      )
      if (!pick) throw new Error(`fixture AI pool exhausted at ${pos}`)
      lineup.push(pick)
      usedGlobal.add(pick.id)
      localTeams.add(pick.teamId)
    }
    return { ids: lineup.map((p) => p.id), order: [] }
  })()

  return {
    playerIds: user.ids,
    battingOrderIds: user.order,
    aiPlayerIds: ai.ids,
  }
}

const basePayload = () => ({
  mode: 'live-draft',
  challengeDate: DATE,
  simSeed: 'test-seed',
  initials: 'TST',
  ...pickLineups(),
})

function postRequest(body: unknown): Request {
  return new Request('https://site/api/live-leaderboard', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '1.2.3.4', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

let inserted: Array<{ query: string; binds: unknown[] }> = []

const dbHandler: MockQueryHandler = (query, binds) => {
  if (query.includes('INSERT INTO live_leaderboard_entries')) {
    inserted.push({ query, binds })
    return {}
  }
  if (query.includes('SELECT 1 AS found FROM live_leaderboard_entries')) {
    return { first: null } // no prior submission for this IP
  }
  if (query.includes('SELECT COUNT(*)')) {
    return { first: { ahead: 0 } }
  }
  if (query.includes('FROM live_leaderboard_entries')) {
    return { all: { results: [] } }
  }
  if (query.includes('FROM live_snapshots')) {
    return { first: null }
  }
  return {}
}

beforeEach(() => {
  inserted = []
})

describe('POST /api/live-leaderboard', () => {
  it('verifies, inserts, and ranks a legal live-draft submission', async () => {
    const response = await onRequest({
      request: postRequest(basePayload()),
      env: { DB: createMockDb(dbHandler), USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      ok: boolean
      rank: number
      series: { userWins: number; opponentWins: number }
    }
    expect(body.ok).toBe(true)
    expect(body.rank).toBe(1)
    expect(body.series.userWins + body.series.opponentWins).toBeGreaterThanOrEqual(2)
    expect(inserted.length).toBe(1)
    expect(String(inserted[0]!.binds.join(','))).toContain('TST')
  })

  it('rejects duplicate submissions before inserting', async () => {
    const dupHandler: MockQueryHandler = (query, binds) => {
      if (query.includes('SELECT 1 AS found FROM live_leaderboard_entries')) {
        return { first: { found: 1 } }
      }
      return dbHandler(query, binds)
    }
    const response = await onRequest({
      request: postRequest(basePayload()),
      env: { DB: createMockDb(dupHandler), USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(409)
    expect(inserted.length).toBe(0)
  })

  it('returns 400 with a reason when the lineup breaks draft rules', async () => {
    const payload = basePayload()
    const response = await onRequest({
      request: postRequest({ ...payload, battingOrderIds: payload.battingOrderIds.slice(0, 5) }),
      env: { DB: createMockDb(dbHandler), USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/Batting order/i)
    expect(inserted.length).toBe(0)
  })

  it('returns 400 when the roster includes players outside the pool', async () => {
    const payload = basePayload()
    payload.playerIds[0] = 'not-a-real-player'
    const response = await onRequest({
      request: postRequest(payload),
      env: { DB: createMockDb(dbHandler), USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(400)
    expect(inserted.length).toBe(0)
  })

  it('returns 503 when the D1 binding is missing', async () => {
    const response = await onRequest({
      request: postRequest(basePayload()),
      env: {},
    })
    expect(response.status).toBe(503)
  })
})
