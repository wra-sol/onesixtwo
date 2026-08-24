import { describe, expect, it } from 'vitest'
import {
  describeLiveShare,
  enrichLiveLeaderboardRow,
  simulateLiveShare,
} from './live-share-sim'
import {
  buildFixtureDailyMatchupSnapshot,
  buildFixtureLiveDraftSnapshot,
} from './live-fixtures'
import type { LiveDraftSnapshot } from './live-types'

const DATE = '2026-06-25'

function draftSnapshot(): LiveDraftSnapshot {
  return buildFixtureLiveDraftSnapshot(DATE)
}

function legalDraftInput(simSeed: string) {
  const pool = draftSnapshot().players
  const hitters = pool.filter((p) => p.role === 'hitter')
  const arms = pool.filter((p) => p.role === 'pitcher')
  return {
    mode: 'live-draft' as const,
    challengeDate: DATE,
    targetDate: undefined,
    playerIds: [...hitters.slice(0, 9), ...arms.slice(0, 3)].map((p) => p.id),
    battingOrderIds: hitters.slice(0, 9).map((p) => p.id),
    aiPlayerIds: [...hitters.slice(9, 18), ...arms.slice(3, 6)].map((p) => p.id),
    simSeed,
  }
}

describe('describeLiveShare vs simulateLiveShare', () => {
  it('produces identical display fields without running the series', () => {
    const snapshot = draftSnapshot()
    const input = legalDraftInput('seed-a')

    const described = describeLiveShare(input, snapshot)!
    const simulated = simulateLiveShare(input, snapshot)!

    expect(described.sharePath).toBe(simulated.sharePath)
    expect(described.lineupSummary).toBe(simulated.lineupSummary)
    expect(described.opponentName).toBe(simulated.opponentName)
    expect(described.opponentName).toBe('AI')
    expect(described.sharePath).toContain('/live-share')
  })

  it('returns null when the snapshot cannot resolve an opponent', () => {
    const input = legalDraftInput('seed-a')
    // Daily Matchup snapshots carry no AI roster to resolve against.
    const dailySnapshot = buildFixtureDailyMatchupSnapshot(DATE, DATE)
    expect(describeLiveShare(input, dailySnapshot)).toBeNull()
  })
})

describe('enrichLiveLeaderboardRow', () => {
  it('derives display fields without depending on simulation variance', () => {
    const snapshot = draftSnapshot()

    function rowWithSeed(simSeed: string) {
      const input = legalDraftInput(simSeed)
      return {
        initials: 'TST',
        mode: 'live-draft' as const,
        challengeDate: DATE,
        targetDate: undefined,
        seriesWins: 2,
        seriesLosses: 1,
        userRuns: 11,
        opponentRuns: 7,
        runDiff: 4,
        wonSeries: true,
        createdAt: 1,
        payloadJson: JSON.stringify({
          mode: 'live-draft',
          challengeDate: DATE,
          simSeed,
          initials: 'TST',
          playerIds: input.playerIds,
          battingOrderIds: input.battingOrderIds,
          aiPlayerIds: input.aiPlayerIds,
        }),
      }
    }

    // Different seeds would replay differently; display fields must not.
    const a = enrichLiveLeaderboardRow(rowWithSeed('seed-a'), snapshot)
    const b = enrichLiveLeaderboardRow(rowWithSeed('seed-b'), snapshot)

    expect(a.lineupSummary).toBe(b.lineupSummary)
    expect(a.opponentName).toBe(b.opponentName)
    expect(a.seriesWins).toBe(2)
    expect(a.sharePath).toContain('seed-a')
    expect(b.sharePath).toContain('seed-b')
  })

  it('falls back to empty share fields on unparseable payloads', () => {
    const snapshot = draftSnapshot()
    const enriched = enrichLiveLeaderboardRow(
      {
        initials: 'TST',
        mode: 'live-draft',
        challengeDate: DATE,
        targetDate: undefined,
        seriesWins: 2,
        seriesLosses: 1,
        userRuns: 11,
        opponentRuns: 7,
        runDiff: 4,
        wonSeries: true,
        createdAt: 1,
        payloadJson: '{not json',
      },
      snapshot,
    )
    expect(enriched.sharePath).toBe('')
    expect(enriched.lineupSummary).toBe('—')
    expect(enriched.opponentName).toBeUndefined()
  })
})
