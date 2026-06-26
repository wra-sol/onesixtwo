import { describe, expect, it } from 'vitest'
import { onRequest, onRequestLiveDraft } from './live-api'

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
