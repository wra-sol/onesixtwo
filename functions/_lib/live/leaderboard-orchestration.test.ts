import { describe, expect, it } from 'vitest'
import {
  assertDailyMatchupSnapshot,
  assertLiveDraftSnapshot,
  parseLiveSubmitPayload,
  resolveSnapshot,
} from './leaderboard-orchestration'

describe('parseLiveSubmitPayload', () => {
  it('accepts daily-matchup payload with targetDate', () => {
    const result = parseLiveSubmitPayload({
      mode: 'daily-matchup',
      challengeDate: '2026-06-25',
      targetDate: '2026-06-24',
      initials: 'ABC',
      playerIds: ['p1'],
      battingOrderIds: ['p1'],
      simSeed: 'seed-1',
    })
    expect(result).toMatchObject({
      mode: 'daily-matchup',
      challengeDate: '2026-06-25',
      targetDate: '2026-06-24',
    })
    expect('ok' in result).toBe(false)
  })

  it('accepts live-draft payload with aiPlayerIds', () => {
    const result = parseLiveSubmitPayload({
      mode: 'live-draft',
      challengeDate: '2026-06-25',
      initials: 'XYZ',
      playerIds: ['p1'],
      battingOrderIds: ['p1'],
      aiPlayerIds: ['p2'],
      simSeed: 'seed-2',
    })
    expect(result).toMatchObject({
      mode: 'live-draft',
      aiPlayerIds: ['p2'],
    })
    expect('ok' in result).toBe(false)
  })

  it('rejects daily-matchup without targetDate', () => {
    const result = parseLiveSubmitPayload({
      mode: 'daily-matchup',
      challengeDate: '2026-06-25',
      initials: 'ABC',
      playerIds: ['p1'],
      battingOrderIds: ['p1'],
      simSeed: 'seed-1',
    })
    expect(result).toEqual({
      ok: false,
      error: 'Daily Matchup requires targetDate.',
    })
  })

  it('rejects live-draft without aiPlayerIds', () => {
    const result = parseLiveSubmitPayload({
      mode: 'live-draft',
      challengeDate: '2026-06-25',
      initials: 'XYZ',
      playerIds: ['p1'],
      battingOrderIds: ['p1'],
      simSeed: 'seed-2',
    })
    expect(result).toEqual({
      ok: false,
      error: 'Live Draft requires aiPlayerIds.',
    })
  })
})

describe('resolveSnapshot', () => {
  it('returns fixture snapshots when USE_LIVE_FIXTURES is true', async () => {
    const daily = await resolveSnapshot(
      'daily-matchup',
      '2026-06-25',
      undefined,
      { USE_LIVE_FIXTURES: 'true' },
    )
    expect(daily.kind).toBe('daily-matchup')
    expect(assertDailyMatchupSnapshot(daily)).toBe(true)

    const draft = await resolveSnapshot(
      'live-draft',
      '2026-06-25',
      undefined,
      { USE_LIVE_FIXTURES: 'true' },
    )
    expect(draft.kind).toBe('live-draft')
    expect(assertLiveDraftSnapshot(draft)).toBe(true)
  })
})
