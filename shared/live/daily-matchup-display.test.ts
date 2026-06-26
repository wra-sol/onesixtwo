import { describe, expect, it } from 'vitest'
import { buildFixtureDailyMatchupSnapshot } from './live-fixtures'
import {
  formatDailyMatchupOpponentHeadline,
  formatDailyMatchupSubtitle,
} from './daily-matchup-display'
import type { DailyMatchupSnapshot } from './live-types'

describe('daily-matchup-display', () => {
  const available = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')

  it('formats opponent headline for available snapshot', () => {
    expect(formatDailyMatchupOpponentHeadline(available)).toBe(
      'Opponent: Los Angeles Dodgers · 12 runs',
    )
  })

  it('formats subtitle for available snapshot', () => {
    expect(formatDailyMatchupSubtitle(available)).toBe(
      'Target 2026-06-24 · Opponent Los Angeles Dodgers (12 runs)',
    )
  })

  it('shows unavailable reason in headline', () => {
    const unavailable: DailyMatchupSnapshot = {
      kind: 'daily-matchup',
      challengeDate: '2026-06-25',
      targetDate: '2026-06-24',
      available: false,
      unavailableReason: 'No MLB games yesterday',
      opponent: null,
      opponentGameScore: { runs: 0, hits: 0, runDiff: 0 },
      players: [],
      simSeed: 'unavailable',
    }

    expect(formatDailyMatchupOpponentHeadline(unavailable)).toBe(
      'No MLB games yesterday',
    )
    expect(formatDailyMatchupSubtitle(unavailable)).toBe('No MLB games yesterday')
  })
})
