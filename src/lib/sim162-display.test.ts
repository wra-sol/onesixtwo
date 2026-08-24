import { describe, expect, it } from 'vitest'
import {
  buildTeamNameById,
  buildUserGameOpponents,
  postseasonLabel,
  postseasonResultLabel,
  playoffSeriesToSimulated,
  seriesGameLetter,
  singleGameToSeries,
  userGameOutcome,
  userGameSides,
} from './sim162-display'
import { coinFlipTieWinner } from '@shared/live/series-sim'
import type { SimulatedGame, SimulatedSeries } from '@shared/live/live-types'
import type {
  PlayoffBracket,
  PlayoffSeries,
  PostseasonResult,
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

describe('singleGameToSeries', () => {
  it('wraps a single user-home win into a 1-0 series', () => {
    const game = makeGame(5, 3, true)
    const series = singleGameToSeries(game, 'Yankees')
    expect(series.games).toHaveLength(1)
    expect(series.games[0]).toBe(game)
    expect(series.userWins).toBe(1)
    expect(series.opponentWins).toBe(0)
    expect(series.userRuns).toBe(5)
    expect(series.opponentRuns).toBe(3)
    expect(series.userRunDiff).toBe(2)
    expect(series.wonSeries).toBe(true)
  })

  it('wraps a single user-away loss into a 0-1 series', () => {
    const game = makeGame(7, 2, false)
    const series = singleGameToSeries(game, 'Astros')
    expect(series.userWins).toBe(0)
    expect(series.opponentWins).toBe(1)
    expect(series.userRuns).toBe(2)
    expect(series.opponentRuns).toBe(7)
    expect(series.userRunDiff).toBe(-5)
    expect(series.wonSeries).toBe(false)
  })

  it('handles a tie as a 0-0 series with wonSeries false', () => {
    const game = makeGame(4, 4, true)
    const series = singleGameToSeries(game, 'Red Sox')
    expect(series.userWins).toBe(0)
    expect(series.opponentWins).toBe(0)
    expect(series.wonSeries).toBe(false)
  })
})

describe('userGameOutcome', () => {
  it('returns W when user scores more, home or away', () => {
    expect(userGameOutcome(makeGame(5, 3, true), 0, 'seed')).toBe('W')
    expect(userGameOutcome(makeGame(3, 5, false), 0, 'seed')).toBe('W')
  })

  it('returns L when opponent scores more, home or away', () => {
    expect(userGameOutcome(makeGame(3, 5, true), 0, 'seed')).toBe('L')
    expect(userGameOutcome(makeGame(5, 3, false), 0, 'seed')).toBe('L')
  })

  it('breaks ties deterministically from the seed', () => {
    const game = makeGame(4, 4, true)
    const a = userGameOutcome(game, 3, 'season-x')
    const b = userGameOutcome(game, 3, 'season-x')
    expect(a).toBe(b)
    expect(a === 'W' || a === 'L').toBe(true)
  })

  it('resolves ties exactly as the engine coin flip does', () => {
    for (let i = 0; i < 20; i += 1) {
      const expected = coinFlipTieWinner('season-x', i) ? 'W' : 'L'
      expect(userGameOutcome(makeGame(4, 4, true), i, 'season-x')).toBe(
        expected,
      )
    }
  })
})

describe('userGameSides', () => {
  it('maps score and box to user/opponent sides when user is home', () => {
    const game: SimulatedGame = {
      ...makeGame(5, 3, true),
      homeBox: { runs: 5, hits: 9, errors: 0, homeRuns: 2 },
      awayBox: { runs: 3, hits: 6, errors: 1, homeRuns: 0 },
    }
    const sides = userGameSides(game)
    expect(sides.score).toEqual({ user: 5, opponent: 3 })
    expect(sides.box.user.runs).toBe(5)
    expect(sides.box.opponent.runs).toBe(3)
  })
})

describe('seriesGameLetter', () => {
  const tie = makeGame(4, 4, true)

  function makeSeries(
    games: SimulatedGame[],
    userWins: number,
    opponentWins: number,
    seed: string,
  ): SimulatedSeries {
    return {
      games,
      userWins,
      opponentWins,
      userRuns: 0,
      opponentRuns: 0,
      userRunDiff: 0,
      wonSeries: userWins > opponentWins,
      seed,
    }
  }

  it('returns W/L for decided games regardless of tie policy', () => {
    const series = makeSeries([makeGame(5, 3, true), tie], 2, 0, 's')
    expect(seriesGameLetter(series, series.games[0], 0)).toBe('W')
    const lost = makeSeries([makeGame(6, 2, false), tie], 0, 2, 's')
    expect(seriesGameLetter(lost, lost.games[0], 0)).toBe('L')
  })

  it('stands ties as T when the series does not credit them', () => {
    // Best-of-3 'stand' series ended 1-1-1: game 3's tie resolves for nobody.
    const series = makeSeries(
      [makeGame(5, 3, true), makeGame(2, 6, false), tie],
      1,
      1,
      's',
    )
    expect(seriesGameLetter(series, tie, 2)).toBe('T')
  })

  it('credits ties via the engine coin flip when every game resolves', () => {
    // All games tied but tallies account for all of them → flips credited.
    const series = makeSeries([tie, tie], 1, 1, 'coin-seed')
    for (let i = 0; i < 2; i += 1) {
      const expected = coinFlipTieWinner('coin-seed', i) ? 'W' : 'L'
      expect(seriesGameLetter(series, tie, i)).toBe(expected)
    }
  })
})

describe('buildTeamNameById', () => {
  it('returns a name for every league team id', () => {
    const map = buildTeamNameById()
    expect(map.get('yankees')).toBe('New York Yankees')
    expect(map.get('dodgers')).toBe('Los Angeles Dodgers')
    expect(map.size).toBeGreaterThanOrEqual(30)
  })
})

describe('buildUserGameOpponents', () => {
  it('returns 162 opponent names aligned with user games', () => {
    const opponents = buildUserGameOpponents('season-fixture', 'yankees')
    expect(opponents).toHaveLength(162)
    for (const name of opponents) {
      expect(name.length).toBeGreaterThan(0)
    }
    const regenerated = buildUserGameOpponents('season-fixture', 'yankees')
    expect(regenerated).toEqual(opponents)
  })

  it('never lists the user team as its own opponent', () => {
    const opponents = buildUserGameOpponents('season-fixture', 'yankees')
    expect(opponents).not.toContain('New York Yankees')
  })
})

describe('playoffSeriesToSimulated', () => {
  it('reconstructs a user-home series with user wins from homeWins', () => {
    const games = [makeGame(4, 2, true), makeGame(3, 1, true)]
    const ps: PlayoffSeries = {
      awaySeed: 4,
      homeSeed: 1,
      awayTeamId: 'rays',
      homeTeamId: 'yankees',
      awayWins: 0,
      homeWins: 2,
      winnerTeamId: 'yankees',
      isUserSeries: true,
      games,
    }
    const series = playoffSeriesToSimulated(ps, 'yankees')
    expect(series.games).toBe(games)
    expect(series.userWins).toBe(2)
    expect(series.opponentWins).toBe(0)
    expect(series.userRuns).toBe(7)
    expect(series.opponentRuns).toBe(3)
    expect(series.wonSeries).toBe(true)
  })

  it('reconstructs a user-away series with user wins from awayWins', () => {
    const games = [makeGame(2, 5, false), makeGame(1, 4, false)]
    const ps: PlayoffSeries = {
      awaySeed: 3,
      homeSeed: 2,
      awayTeamId: 'yankees',
      homeTeamId: 'astros',
      awayWins: 2,
      homeWins: 0,
      winnerTeamId: 'yankees',
      isUserSeries: true,
      games,
    }
    const series = playoffSeriesToSimulated(ps, 'yankees')
    expect(series.userWins).toBe(2)
    expect(series.opponentWins).toBe(0)
    expect(series.userRuns).toBe(9)
    expect(series.opponentRuns).toBe(3)
    expect(series.wonSeries).toBe(true)
  })

  it('falls back to empty games when no games are present', () => {
    const ps: PlayoffSeries = {
      awaySeed: 5,
      homeSeed: 4,
      awayTeamId: 'mariners',
      homeTeamId: 'rangers',
      awayWins: 2,
      homeWins: 1,
      winnerTeamId: 'mariners',
      isUserSeries: false,
    }
    const series = playoffSeriesToSimulated(ps, 'yankees')
    expect(series.games).toEqual([])
    expect(series.userWins).toBe(2)
    expect(series.opponentWins).toBe(1)
    expect(series.wonSeries).toBe(false)
  })
})

describe('postseasonLabel', () => {
  function makeResult(
    postseason: PostseasonResult,
    wonWorldSeries: boolean,
  ): Sim162SeasonResult {
    return {
      userRecord: { wins: 90, losses: 72 },
      userGames: [],
      standings: {
        records: [],
        byDivision: {} as never,
        byLeague: { AL: [], NL: [] },
      },
      playoffField: [],
      userQualified: postseason !== 'missed',
      userPlayoffSeed: 1,
      playoffBracket: {} as PlayoffBracket,
      userPlayoffSeries: [],
      wonWorldSeries,
      postseasonResult: postseason,
      marqueeGames: [],
      seasonSeed: 'x',
    }
  }

  it('returns World Series Champions! when wonWorldSeries is true', () => {
    expect(postseasonLabel(makeResult('lcs', true))).toBe(
      'World Series Champions!',
    )
  })

  it('maps each postseason result to its label', () => {
    expect(postseasonResultLabel('ws-champs')).toBe('World Series Champions!')
    expect(postseasonResultLabel('ws-runner-up')).toBe(
      'World Series Runner-Up',
    )
    expect(postseasonResultLabel('lcs')).toBe('League Championship Series')
    expect(postseasonResultLabel('ds')).toBe('Division Series')
    expect(postseasonResultLabel('wc')).toBe('Wild Card')
    expect(postseasonResultLabel('missed')).toBe('Missed the Playoffs')
  })

  it('uses the result label when not world series champs', () => {
    expect(postseasonLabel(makeResult('wc', false))).toBe('Wild Card')
    expect(postseasonLabel(makeResult('missed', false))).toBe(
      'Missed the Playoffs',
    )
  })
})
