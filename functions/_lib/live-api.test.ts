import { describe, expect, it } from 'vitest'
import { onRequest, onRequestLiveDraft, onRequestSim162Live } from './live-api'

describe('live-api snapshot handlers', () => {
  it('returns fixture daily matchup when USE_LIVE_FIXTURES is true', async () => {
    const response = await onRequest({
      request: new Request('http://localhost/api/daily-matchup'),
      env: { USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string; available: boolean }
    expect(body.kind).toBe('daily-matchup')
    expect(body.available).toBe(true)
  })

  it('returns fixture live draft when USE_LIVE_FIXTURES is true', async () => {
    const response = await onRequestLiveDraft({
      request: new Request('http://localhost/api/live-draft'),
      env: { USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string; players: unknown[] }
    expect(body.kind).toBe('live-draft')
    expect(body.players.length).toBeGreaterThan(0)
  })
})

describe('sim162-live snapshot handler', () => {
  it('serves fixture sim162 pool when USE_LIVE_FIXTURES is true', async () => {
    const response = await onRequestSim162Live({
      request: new Request('http://localhost/api/sim162-live-snapshot'),
      env: { USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string; players: unknown[]; simSeed: string }
    expect(body.kind).toBe('sim162-live')
    expect(body.players.length).toBeGreaterThan(0)
    expect(body.simSeed.endsWith('|sim162-live')).toBe(true)
  })
})
