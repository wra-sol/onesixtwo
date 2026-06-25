import { describe, expect, it } from 'vitest'
import { createEmptyDailyLineup } from './daily-roster'
import {
  buildLiveSharePath,
  formatLiveLineupSummary,
  isParsedLiveShare,
  parseLiveShareParams,
} from './live-share-url'
import type { LivePlayer } from './live-types'

function samplePlayer(id: string, name: string): LivePlayer {
  return {
    id,
    personId: 1,
    name,
    teamId: 147,
    teamAbbrev: 'NYY',
    teamName: 'New York Yankees',
    positions: ['DH'],
    role: 'hitter',
    grades: { overall: 60 },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

describe('live-share-url', () => {
  it('builds and parses a daily matchup share link', () => {
    const playerIds = Array.from({ length: 12 }, (_, index) => `p${index}`)
    const path = buildLiveSharePath({
      mode: 'daily-matchup',
      challengeDate: '2026-06-25',
      targetDate: '2026-06-24',
      playerIds,
      battingOrderIds: playerIds.slice(0, 9),
      simSeed: 'seed-1',
    })
    const parsed = parseLiveShareParams(new URLSearchParams(path.split('?')[1]))
    expect(isParsedLiveShare(parsed)).toBe(true)
    if (isParsedLiveShare(parsed)) {
      expect(parsed.mode).toBe('daily-matchup')
      expect(parsed.targetDate).toBe('2026-06-24')
      expect(parsed.playerIds).toHaveLength(12)
    }
  })

  it('builds and parses a live draft share link', () => {
    const playerIds = Array.from({ length: 12 }, (_, index) => `u${index}`)
    const aiPlayerIds = Array.from({ length: 12 }, (_, index) => `a${index}`)
    const path = buildLiveSharePath({
      mode: 'live-draft',
      challengeDate: '2026-06-25',
      playerIds,
      battingOrderIds: playerIds.slice(0, 9),
      aiPlayerIds,
      simSeed: 'seed-2',
    })
    const parsed = parseLiveShareParams(new URLSearchParams(path.split('?')[1]))
    expect(isParsedLiveShare(parsed)).toBe(true)
    if (isParsedLiveShare(parsed)) {
      expect(parsed.aiPlayerIds).toHaveLength(12)
    }
  })

  it('formats lineup summaries with opponent', () => {
    const lineup = createEmptyDailyLineup()
    lineup.C = samplePlayer('c', 'Player One')
    lineup['1B'] = samplePlayer('1b', 'Player Two')
    lineup['2B'] = samplePlayer('2b', 'Player Three')
    lineup['3B'] = samplePlayer('3b', 'Player Four')
    expect(formatLiveLineupSummary(lineup, { opponentName: 'Dodgers' })).toContain(
      'vs Dodgers',
    )
  })
})
