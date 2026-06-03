import { lineupErrorPenalty } from './rating-anchors'
import type { HitterStats, Player } from './types'

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

/** Sum prorated fielding errors per 162 for non-pitcher lineup slots. */
export function lineupErrorsPer162(players: Player[]): number {
  const fielders = players.filter((p) => p.role === 'hitter')
  let total = 0
  for (const player of fielders) {
    const stats = player.stats as HitterStats
    const errors = stats.errors ?? 0
    const games = stats.fieldingGames ?? stats.g ?? 162
    total += (errors / Math.max(games, 1)) * 162
  }
  return total
}

export type RunPreventionBreakdown = {
  value: number
  pitcherValue: number
  errorPenalty: number
  lineupErrorsPer162: number
}

/** Pitcher run prevention minus lineup fielding error penalty. */
export function calculateRunPrevention(players: Player[]): RunPreventionBreakdown {
  const pitchers = players.filter((p) => p.role === 'pitcher')
  const pitcherValue = avg(pitchers.map((p) => p.ratings.era))
  const errorsTotal = lineupErrorsPer162(players)
  const errorPenalty = lineupErrorPenalty(errorsTotal)
  const value = Math.round(
    Math.max(0, Math.min(100, pitcherValue - errorPenalty)),
  )

  return {
    value,
    pitcherValue: Math.round(pitcherValue),
    errorPenalty,
    lineupErrorsPer162: Math.round(errorsTotal),
  }
}
