import { describe, expect, it } from 'vitest'
import {
  buildTeamNameById,
  buildUserGameOpponents,
  postseasonLabel,
  postseasonResultLabel,
  playoffSeriesToSimulated,
  singleGameToSeries,
  userGameOutcome,
} from './sim162-display'
import type { SimulatedGame } from '@shared/live/live-types'
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
