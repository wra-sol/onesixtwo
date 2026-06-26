import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

afterEach(() => {
  cleanup()
})

import Sim162ResultScreen from '@/components/Sim162ResultScreen'
import type {
  SimulatedGame,
  SimulatedSeries,
} from '@shared/live/live-types'
import type {
  PlayoffBracket,
  PlayoffRound,
  PlayoffSeries,
  Sim162SeasonResult,
} from '@shared/live/sim162-season'

function makeGame(
  homeScore: number,
  awayScore: number,
  userWasHome: boolean,
): SimulatedGame {
  return {
    homeScore,
    awayScore,
    homeBox: { runs: homeScore, hits: 0, errors: 0, homeRuns: 0 },
    awayBox: { runs: awayScore, hits: 0, errors: 0, homeRuns: 0 },
    events: [],
    userWasHome,
  }
}

function makeUserGames(count: number): SimulatedGame[] {
  const games: SimulatedGame[] = []
  for (let i = 0; i < count; i += 1) {
    const userWasHome = i % 2 === 0
    const userScore = (i % 5) + 2
    const oppScore = i % 3
    const homeScore = userWasHome ? userScore : oppScore
    const awayScore = userWasHome ? oppScore : userScore
    games.push(makeGame(homeScore, awayScore, userWasHome))
  }
  return games
}

function makePlayoffGames(
  count: number,
  userIsHomeTeam: boolean,
): SimulatedGame[] {
  const games: SimulatedGame[] = []
  for (let i = 0; i < count; i += 1) {
    const userWasHome = userIsHomeTeam ? i % 2 === 0 : i % 2 === 1
    const userScore = 4
    const oppScore = 2
    const homeScore = userWasHome ? userScore : oppScore
    const awayScore = userWasHome ? oppScore : userScore
    games.push(makeGame(homeScore, awayScore, userWasHome))
  }
  return games
}

function makeSimulatedSeries(
  games: SimulatedGame[],
  userWins: number,
  opponentWins: number,
  seed: string,
): SimulatedSeries {
  let userRuns = 0
  let opponentRuns = 0
  for (const g of games) {
    userRuns += g.userWasHome ? g.homeScore : g.awayScore
    opponentRuns += g.userWasHome ? g.awayScore : g.homeScore
  }
  return {
    games,
    userWins,
    opponentWins,
    userRuns,
    opponentRuns,
    userRunDiff: userRuns - opponentRuns,
    wonSeries: userWins > opponentWins,
    seed,
  }
}

function nonUserSeries(
  awaySeed: number,
  awayTeamId: string,
  homeSeed: number,
  homeTeamId: string,
  awayWins: number,
  homeWins: number,
  winnerTeamId: string,
): PlayoffSeries {
  return {
    awaySeed,
    awayTeamId,
    homeSeed,
    homeTeamId,
    awayWins,
    homeWins,
    winnerTeamId,
    isUserSeries: false,
  }
}

function userSeries(
  awaySeed: number,
  awayTeamId: string,
  homeSeed: number,
  homeTeamId: string,
  awayWins: number,
  homeWins: number,
  winnerTeamId: string,
  games: SimulatedGame[],
): PlayoffSeries {
  return {
    awaySeed,
    awayTeamId,
    homeSeed,
    homeTeamId,
    awayWins,
    homeWins,
    winnerTeamId,
    isUserSeries: true,
    games,
  }
}

const USER_TEAM = 'yankees'
const SEASON_SEED = 'sim162-fixture-seed'

function buildChampsResult(): Sim162SeasonResult {
  const dsGames = makePlayoffGames(4, true)
  const lcsGames = makePlayoffGames(6, true)
  const wsGames = makePlayoffGames(7, true)
  const dsSeries = makeSimulatedSeries(dsGames, 3, 1, 'ds')
  const lcsSeries = makeSimulatedSeries(lcsGames, 4, 2, 'lcs')
  const wsSeries = makeSimulatedSeries(wsGames, 4, 3, 'ws')

  const rounds: PlayoffRound[] = [
    {
      name: 'Wild Card',
      series: [
        nonUserSeries(6, 'mariners', 3, 'guardians', 1, 2, 'guardians'),
        nonUserSeries(5, 'royals', 4, 'rangers', 0, 2, 'rangers'),
        nonUserSeries(6, 'giants', 3, 'cardinals', 1, 2, 'cardinals'),
        nonUserSeries(5, 'phillies', 4, 'padres', 0, 2, 'padres'),
      ],
    },
    {
      name: 'Division Series',
      series: [
        userSeries(4, 'rangers', 1, USER_TEAM, 1, 3, USER_TEAM, dsGames),
        nonUserSeries(3, 'guardians', 2, 'astros', 2, 3, 'astros'),
        nonUserSeries(4, 'padres', 1, 'dodgers', 1, 3, 'dodgers'),
        nonUserSeries(3, 'cardinals', 2, 'braves', 0, 3, 'braves'),
      ],
    },
    {
      name: 'League Championship',
      series: [
        userSeries(2, 'astros', 1, USER_TEAM, 2, 4, USER_TEAM, lcsGames),
        nonUserSeries(2, 'braves', 1, 'dodgers', 3, 4, 'dodgers'),
      ],
    },
    {
      name: 'World Series',
      series: [
        userSeries(1, 'dodgers', 1, USER_TEAM, 3, 4, USER_TEAM, wsGames),
      ],
    },
  ]

  const bracket: PlayoffBracket = {
    rounds,
    userTeamId: USER_TEAM,
    userLeague: 'AL',
  }

  return {
    userRecord: { wins: 110, losses: 52 },
    userGames: makeUserGames(162),
    standings: {
      records: [],
      byDivision: {} as never,
      byLeague: { AL: [], NL: [] },
    },
    playoffField: [],
    userQualified: true,
    userPlayoffSeed: 1,
    playoffBracket: bracket,
    userPlayoffSeries: [dsSeries, lcsSeries, wsSeries],
    wonWorldSeries: true,
    postseasonResult: 'ws-champs',
    marqueeGames: [
      { gameIndex: 0, label: 'Clincher', game: makeGame(5, 3, true) },
    ],
    seasonSeed: SEASON_SEED,
  }
}

function buildEliminatedResult(): Sim162SeasonResult {
  const rounds: PlayoffRound[] = [
    {
      name: 'Wild Card',
      series: [
        nonUserSeries(6, 'mariners', 3, 'guardians', 1, 2, 'guardians'),
        nonUserSeries(5, 'royals', 4, 'rangers', 0, 2, 'rangers'),
        nonUserSeries(6, 'giants', 3, 'cardinals', 1, 2, 'cardinals'),
        nonUserSeries(5, 'phillies', 4, 'padres', 0, 2, 'padres'),
      ],
    },
    {
      name: 'Division Series',
      series: [
        nonUserSeries(4, 'rangers', 1, 'astros', 1, 3, 'astros'),
        nonUserSeries(3, 'guardians', 2, 'red-sox', 2, 3, 'red-sox'),
        nonUserSeries(4, 'padres', 1, 'dodgers', 1, 3, 'dodgers'),
        nonUserSeries(3, 'cardinals', 2, 'braves', 0, 3, 'braves'),
      ],
    },
    {
      name: 'League Championship',
      series: [
        nonUserSeries(2, 'red-sox', 1, 'astros', 2, 4, 'astros'),
        nonUserSeries(2, 'braves', 1, 'dodgers', 3, 4, 'dodgers'),
      ],
    },
    {
      name: 'World Series',
      series: [nonUserSeries(1, 'dodgers', 1, 'astros', 2, 4, 'astros')],
    },
  ]
  const bracket: PlayoffBracket = {
    rounds,
    userTeamId: USER_TEAM,
    userLeague: 'AL',
  }

  return {
    userRecord: { wins: 70, losses: 92 },
    userGames: makeUserGames(162),
    standings: {
      records: [],
      byDivision: {} as never,
      byLeague: { AL: [], NL: [] },
    },
    playoffField: [],
    userQualified: false,
    userPlayoffSeed: null,
    playoffBracket: bracket,
    userPlayoffSeries: [],
    wonWorldSeries: false,
    postseasonResult: 'missed',
    marqueeGames: [
      { gameIndex: 0, label: 'Season finale', game: makeGame(5, 3, true) },
    ],
    seasonSeed: SEASON_SEED,
  }
}

describe('Sim162ResultScreen — qualified (World Series champs)', () => {
  it('shows the record, champions label, and celebratory callout', () => {
      render(
        <Sim162ResultScreen
          result={buildChampsResult()}
          onRestart={() => {}}
        />,
      )
      screen.getByText('110-52')
      expect(screen.getAllByText('World Series Champions!').length).toBe(2)
      screen.getByText('Marquee games')
      expect(screen.queryByText('Eliminated — missed the playoffs.')).toBeNull()
    },
  )

  it('renders 162 box-score cards with marquee highlighted', () => {
      const { container } = render(
        <Sim162ResultScreen
          result={buildChampsResult()}
          onRestart={() => {}}
        />,
      )
      const cards = container.querySelectorAll('[aria-label^="Game "]')
      expect(cards.length).toBe(162)
      const marquee = container.querySelector('[aria-label*="Marquee game"]')
      expect(marquee).not.toBeNull()
    },
  )

  it('renders the playoff bracket with three user-series Watch buttons', () => {
      render(
        <Sim162ResultScreen
          result={buildChampsResult()}
          onRestart={() => {}}
        />,
      )
      screen.getByText('Postseason')
      screen.getByText('Wild Card')
      const watchButtons = screen.getAllByRole('button', { name: 'Watch' })
      expect(watchButtons.length).toBe(3)
    },
  )

  it('opens a marquee broadcast when Watch highlights is clicked', () => {
      render(
        <Sim162ResultScreen
          result={buildChampsResult()}
          onRestart={() => {}}
        />,
      )
      expect(screen.queryByText('Series win')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Watch highlights' }))
      screen.getByText('Series win')
    },
  )

  it('opens a postseason series broadcast when a bracket Watch button is clicked', () => {
      render(
        <Sim162ResultScreen
          result={buildChampsResult()}
          onRestart={() => {}}
        />,
      )
      const watchButtons = screen.getAllByRole('button', { name: 'Watch' })
      fireEvent.click(watchButtons[0]!)
      screen.getByText('Texas Rangers — series broadcast')
    },
  )

  it('calls onRestart when Play again is clicked', () => {
      const onRestart = vi.fn()
      render(
        <Sim162ResultScreen
          result={buildChampsResult()}
          onRestart={onRestart}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
      expect(onRestart).toHaveBeenCalledTimes(1)
    },
  )
})

describe('Sim162ResultScreen — eliminated (missed playoffs)', () => {
  it('shows the record, missed label, and elimination message', () => {
      render(
        <Sim162ResultScreen
          result={buildEliminatedResult()}
          onRestart={() => {}}
        />,
      )
      screen.getByText('70-92')
      screen.getByText('Missed the Playoffs')
      screen.getByText('Eliminated — missed the playoffs.')
      screen.getByText('Draft better next time.')
      expect(screen.queryByText('World Series Champions!')).toBeNull()
    },
  )

  it('does not render the postseason bracket section', () => {
      render(
        <Sim162ResultScreen
          result={buildEliminatedResult()}
          onRestart={() => {}}
        />,
      )
      expect(screen.queryByText('Postseason')).toBeNull()
      expect(screen.queryByText('Wild Card')).toBeNull()
      expect(screen.queryAllByRole('button', { name: 'Watch' })).toHaveLength(0)
    },
  )

  it('still renders the 162-game box scores and marquee toggle', () => {
      const { container } = render(
        <Sim162ResultScreen
          result={buildEliminatedResult()}
          onRestart={() => {}}
        />,
      )
      expect(
        container.querySelectorAll('[aria-label^="Game "]').length,
      ).toBe(162)
      screen.getByRole('button', { name: 'Watch highlights' })
    },
  )
})
