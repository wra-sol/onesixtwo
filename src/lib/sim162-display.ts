import {
  buildLeagueStrengths,
  generateSchedule,
} from '@shared/live/league-standings'
import { coinFlipTieWinner } from '@shared/live/series-sim'
import type { PlayoffSeries } from '@shared/live/sim162-season'
import type { SimulatedGame, SimulatedSeries } from '@shared/live/live-types'
import type { SimBoxScore } from '@shared/live/live-types'
import type { PostseasonResult, Sim162SeasonResult } from '@shared/live/sim162-season'

export function buildTeamNameById(): Map<string, string> {
  return new Map(
    buildLeagueStrengths({}).map((t) => [t.teamId, t.teamName]),
  )
}

export function buildUserGameOpponents(
  seasonSeed: string,
  userTeamId: string,
): string[] {
  const nameById = buildTeamNameById()
  const schedule = generateSchedule(seasonSeed)
  const userSchedule = schedule
    .filter((g) => g.home === userTeamId || g.away === userTeamId)
    .sort((a, b) => a.gameIndex - b.gameIndex)
  return userSchedule.map((g) => {
    const oppId = g.home === userTeamId ? g.away : g.home
    return nameById.get(oppId) ?? oppId
  })
}

export function userGameScore(game: SimulatedGame): {
  user: number
  opponent: number
} {
  return userGameSides(game).score
}

/** User/opponent view of a game's score and box score, resolved from userWasHome. */
export function userGameSides(game: SimulatedGame): {
  score: { user: number; opponent: number }
  box: { user: SimBoxScore; opponent: SimBoxScore }
} {
  return {
    score: {
      user: game.userWasHome ? game.homeScore : game.awayScore,
      opponent: game.userWasHome ? game.awayScore : game.homeScore,
    },
    box: {
      user: game.userWasHome ? game.homeBox : game.awayBox,
      opponent: game.userWasHome ? game.awayBox : game.homeBox,
    },
  }
}

/** Away/home labels for a game's box score given user/opponent naming. */
export function sideLabels(
  game: SimulatedGame,
  userTeamLabel: string,
  opponentTeamLabel: string,
): { awayLabel: string; homeLabel: string } {
  return {
    awayLabel: game.userWasHome ? opponentTeamLabel : userTeamLabel,
    homeLabel: game.userWasHome ? userTeamLabel : opponentTeamLabel,
  }
}

export function userGameOutcome(
  game: SimulatedGame,
  gameIndex: number,
  seasonSeed: string,
): 'W' | 'L' {
  const { user, opponent } = userGameScore(game)
  if (user > opponent) return 'W'
  if (opponent > user) return 'L'
  return coinFlipTieWinner(seasonSeed, gameIndex) ? 'W' : 'L'
}

/**
 * Per-game W/L/T letter for a series recap, honoring the series tie policy:
 * when the series credits ties (every game resolved to a side) the seeded
 * coin flip decides the letter; otherwise a tied game stands as 'T'.
 */
export function seriesGameLetter(
  series: SimulatedSeries,
  game: SimulatedGame,
  gameIndex: number,
): 'W' | 'L' | 'T' {
  const { user, opponent } = userGameScore(game)
  if (user > opponent) return 'W'
  if (opponent > user) return 'L'
  const tiesCredited =
    series.userWins + series.opponentWins === series.games.length
  if (!tiesCredited) return 'T'
  return coinFlipTieWinner(series.seed, gameIndex) ? 'W' : 'L'
}

export function singleGameToSeries(
  game: SimulatedGame,
  opponentName: string,
): SimulatedSeries {
  void opponentName
  const { user, opponent } = userGameScore(game)
  const userWins = user > opponent ? 1 : 0
  const opponentWins = opponent > user ? 1 : 0
  return {
    games: [game],
    userWins,
    opponentWins,
    userRuns: user,
    opponentRuns: opponent,
    userRunDiff: user - opponent,
    wonSeries: userWins > opponentWins,
    seed: 'marquee-single',
  }
}

export function playoffSeriesToSimulated(
  ps: PlayoffSeries,
  userTeamId: string,
): SimulatedSeries {
  const games = ps.games ?? []
  const userIsHome = ps.homeTeamId === userTeamId
  const userWins = userIsHome ? ps.homeWins : ps.awayWins
  const opponentWins = userIsHome ? ps.awayWins : ps.homeWins
  let userRuns = 0
  let opponentRuns = 0
  for (const g of games) {
    const { user, opponent } = userGameScore(g)
    userRuns += user
    opponentRuns += opponent
  }
  return {
    games,
    userWins,
    opponentWins,
    userRuns,
    opponentRuns,
    userRunDiff: userRuns - opponentRuns,
    wonSeries: ps.winnerTeamId === userTeamId,
    seed: `playoff|${ps.awayTeamId}|${ps.homeTeamId}`,
  }
}

export function postseasonLabel(result: Sim162SeasonResult): string {
  if (result.wonWorldSeries) return 'World Series Champions!'
  return postseasonResultLabel(result.postseasonResult)
}

export function postseasonResultLabel(postseason: PostseasonResult): string {
  switch (postseason) {
    case 'ws-champs':
      return 'World Series Champions!'
    case 'ws-runner-up':
      return 'World Series Runner-Up'
    case 'lcs':
      return 'League Championship Series'
    case 'ds':
      return 'Division Series'
    case 'wc':
      return 'Wild Card'
    case 'missed':
      return 'Missed the Playoffs'
  }
}
