import {
  buildLeagueStrengths,
  generateSchedule,
} from '@shared/live/league-standings'
import { hashSeed } from '@shared/live/rng'
import type { PlayoffSeries } from '@shared/live/sim162-season'
import type { SimulatedGame, SimulatedSeries } from '@shared/live/live-types'
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
  return {
    user: game.userWasHome ? game.homeScore : game.awayScore,
    opponent: game.userWasHome ? game.awayScore : game.homeScore,
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
  return hashSeed(`${seasonSeed}|tie|${gameIndex}`) % 2 === 0 ? 'W' : 'L'
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
