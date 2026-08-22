import { hashSeed } from './rng'
import type { SimulatedGame, SimulatedSeries } from './live-types'

/**
 * What happens when a simulated game ends in a tie.
 *
 * - 'stand': neither side is credited; a best-of-3 can end 1-1-1 and nobody
 *   wins the series.
 * - 'coin-flip': a seeded coin flip awards the game, so a series always has
 *   a winner.
 */
export type SeriesTiePolicy = 'stand' | 'coin-flip'

export type SeriesPlayInput = {
  bestOf: number
  seed: string
  /**
   * Parity of game indices where the user is the home team. Game 0 uses this
   * parity, then home/away alternates.
   */
  userHomeParity: 'even' | 'odd'
  tiePolicy: SeriesTiePolicy
  simulateGame: (index: number, userIsHome: boolean) => SimulatedGame
}

export function winsNeeded(bestOf: number): number {
  if (bestOf === 3) return 2
  if (bestOf === 5) return 3
  return 4
}

export function coinFlipTieWinner(seed: string, index: number): boolean {
  return hashSeed(`${seed}|tie|${index}`) % 2 === 0
}

export function playSeries(input: SeriesPlayInput): SimulatedSeries {
  const needed = winsNeeded(input.bestOf)
  const games: SimulatedGame[] = []
  let userWins = 0
  let opponentWins = 0
  let userRuns = 0
  let opponentRuns = 0

  for (
    let i = 0;
    i < input.bestOf && userWins < needed && opponentWins < needed;
    i += 1
  ) {
    const userIsHome =
      input.userHomeParity === 'even' ? i % 2 === 0 : i % 2 === 1
    const game = input.simulateGame(i, userIsHome)
    games.push(game)

    const userScore = game.userWasHome ? game.homeScore : game.awayScore
    const oppScore = game.userWasHome ? game.awayScore : game.homeScore
    userRuns += userScore
    opponentRuns += oppScore

    if (userScore > oppScore) {
      userWins += 1
    } else if (oppScore > userScore) {
      opponentWins += 1
    } else if (input.tiePolicy === 'coin-flip') {
      if (coinFlipTieWinner(input.seed, i)) userWins += 1
      else opponentWins += 1
    }
  }

  return {
    games,
    userWins,
    opponentWins,
    userRuns,
    opponentRuns,
    userRunDiff: userRuns - opponentRuns,
    wonSeries: userWins > opponentWins,
    seed: input.seed,
  }
}
