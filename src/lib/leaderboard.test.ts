import { describe, expect, it } from 'vitest'
import {
  buildLineupKey,
  compareLeaderboardRows,
  normalizeInitials,
  parseLeaderboardPeriod,
  parseLimit,
  parseSubmitPayload,
  periodStartMs,
  rankForEntry,
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

  it('builds stable lineup keys', () => {
    const lineup = buildBenchmarkLineup('great')
    const sharePath = buildSharePath(lineup, 0, 'classic')
    const parsed = parseShareParams(
      new URLSearchParams(sharePath.split('?')[1]!),
    )
    expect(typeof parsed).toBe('object')
    if (typeof parsed === 'string') throw new Error(parsed)

    expect(buildLineupKey(parsed.playerIds, 'classic', 'all-time')).toBe(
      `all-time:classic:${parsed.playerIds.join(',')}`,
    )
  })

  it('ranks entries by wins, losses, rating, then time', () => {
    const entries = [
      { wins: 120, losses: 42, teamScore: 88, createdAt: 10 },
      { wins: 130, losses: 32, teamScore: 90, createdAt: 20 },
      { wins: 130, losses: 32, teamScore: 90, createdAt: 5 },
    ]

    expect(
      compareLeaderboardRows(entries[1]!, entries[0]!),
    ).toBeLessThan(0)
    expect(rankForEntry(entries[2]!, entries)).toBe(1)
    expect(rankForEntry(entries[1]!, entries)).toBe(2)
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
