import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('@/lib/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

afterEach(() => {
  cleanup()
})

import SeriesBroadcast from '@/components/SeriesBroadcast'
import { coinFlipTieWinner } from '@shared/live/series-sim'
import type { SimulatedGame, SimulatedSeries } from '@shared/live/live-types'

function tiedGame(): SimulatedGame {
  return {
    homeScore: 3,
    awayScore: 3,
    homeBox: { runs: 3, hits: 0, errors: 0, homeRuns: 0 },
    awayBox: { runs: 3, hits: 0, errors: 0, homeRuns: 0 },
    events: [],
    userWasHome: true,
  }
}

function tiedSeries(
  userWins: number,
  opponentWins: number,
  seed: string,
): SimulatedSeries {
  const games = [tiedGame()]
  return {
    games,
    userWins,
    opponentWins,
    userRuns: 3,
    opponentRuns: 3,
    userRunDiff: 0,
    wonSeries: userWins > opponentWins,
    seed,
  }
}

describe('SeriesRecap — game rows under each tie policy', () => {
  it('resolves a credited tie with the seeded coin flip (coin-flip policy)', () => {
    const seed = 'recap-tie-flip'
    render(
      <SeriesBroadcast
        series={tiedSeries(1, 0, seed)}
        opponentName="Opponent"
      />,
    )
    const expectedLetter = coinFlipTieWinner(seed, 0) ? 'W' : 'L'
    screen.getByText(`${expectedLetter} 3-3`)
    expect(screen.queryByText('T 3-3')).toBeNull()
  })

  it('shows T when the tie stands (live-modes policy)', () => {
    render(
      <SeriesBroadcast
        series={tiedSeries(0, 0, 'recap-tie-stand')}
        opponentName="Opponent"
      />,
    )
    screen.getByText('T 3-3')
  })
})
