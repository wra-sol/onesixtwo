import { describe, expect, it } from 'vitest'
import {
  buildLineupKey,
  normalizeInitials,
  parseLeaderboardPeriod,
  parseLimit,
  parseSubmitPayload,
  periodStartMs,
  startOfRollingDayMs,
  startOfUtcDayMs,
  startOfUtcWeekMs,
} from '../../functions/_lib/leaderboard'
import { buildSharePath, parseShareParams } from './share-url'
import { buildBenchmarkLineup } from './benchmarks'
import { sharePathToSubmitPayload } from './leaderboard'

describe('leaderboard server helpers', () => {
  it('validates initials', () => {
    expect(normalizeInitials('ab')).toBe('AB')
    expect(normalizeInitials(' xyz ')).toBe('XYZ')
    expect(normalizeInitials('1')).toBeNull()
    expect(normalizeInitials('a')).toBeNull()
    expect(normalizeInitials('abcd')).toBeNull()
  })

  it('parses leaderboard periods and limits', () => {
    expect(parseLeaderboardPeriod('daily')).toBe('daily')
    expect(parseLeaderboardPeriod('weekly')).toBe('weekly')
    expect(parseLeaderboardPeriod('all')).toBe('all')
    expect(parseLeaderboardPeriod('monthly')).toBeNull()
    expect(parseLimit(null)).toBe(30)
    expect(parseLimit('10')).toBe(10)
    expect(parseLimit('500')).toBe(30)
  })

  it('computes UTC period windows', () => {
    const now = Date.UTC(2026, 5, 4, 15, 30, 0)
    expect(startOfUtcDayMs(now)).toBe(Date.UTC(2026, 5, 4))
    expect(startOfUtcWeekMs(now)).toBe(Date.UTC(2026, 5, 1))
    expect(periodStartMs('all', now)).toBeNull()
  })

  it('uses a rolling 24-hour daily window', () => {
    const now = Date.UTC(2026, 5, 4, 15, 30, 0)
    const yesterday = Date.UTC(2026, 5, 3, 15, 30, 0)

    expect(startOfRollingDayMs(now)).toBe(yesterday)
    expect(periodStartMs('daily', now)).toBe(yesterday)
  })

  it('rejects rerolled submissions', () => {
    const lineup = buildBenchmarkLineup('great')
    const sharePath = buildSharePath(lineup, 2, 'classic')
    const params = new URLSearchParams(sharePath.split('?')[1]!)

    expect(
      parseSubmitPayload({
        initials: 'ABC',
        d: params.get('d') ?? undefined,
        n: params.get('n') ?? undefined,
      }),
    ).toBe('reroll_not_allowed')
  })

  it('accepts first-simulation submissions', () => {
    const lineup = buildBenchmarkLineup('great')
    const sharePath = buildSharePath(lineup, 0, 'classic')
    const params = new URLSearchParams(sharePath.split('?')[1]!)

    const payload = parseSubmitPayload({
      initials: 'ps',
      d: params.get('d') ?? undefined,
    })

    expect(typeof payload).toBe('object')
    if (typeof payload === 'string') {
      throw new Error(payload)
    }
    expect(payload.initials).toBe('PS')
    expect(payload.reroll).toBe(0)
  })

  it('builds one key per team regardless of share order', () => {
    const lineup = buildBenchmarkLineup('great')
    const sharePath = buildSharePath(lineup, 0, 'classic')
    const parsed = parseShareParams(
      new URLSearchParams(sharePath.split('?')[1]!),
    )
    expect(typeof parsed).toBe('object')
    if (typeof parsed === 'string') throw new Error(parsed)

    const reversed = [...parsed.playerIds].reverse()
    expect(buildLineupKey(parsed.playerIds, 'classic')).toBe(
      buildLineupKey(reversed, 'classic'),
    )
  })
})

describe('leaderboard client helpers', () => {
  it('builds submit payload from share path', () => {
    const lineup = buildBenchmarkLineup('great')
    const sharePath = buildSharePath(lineup, 0, 'classic')
    const payload = sharePathToSubmitPayload(sharePath)

    expect(payload.d).toBeTruthy()
    expect(payload.p).toBeUndefined()
    expect(payload.n).toBeUndefined()
  })
})
