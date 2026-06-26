import { describe, expect, it } from 'vitest'
import { onRequest } from '../api/daily-matchup'

describe('daily-matchup api route', () => {
  it('delegates GET to live-api handler without recursion', async () => {
    const response = await onRequest({
      request: new Request('http://localhost/api/daily-matchup'),
      env: { USE_LIVE_FIXTURES: 'true' },
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string }
    expect(body.kind).toBe('daily-matchup')
  })
})
