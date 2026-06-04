import { playerHasPitchingProfile } from './player-eligibility'
import { getPitchingRatings } from './player-ratings'
import { lineupEntries, type LineupEntry } from './roster-format'
import { lineupErrorPenalty } from './rating-anchors'
import type { HitterStats, Lineup, RosterFormatId } from './types'

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

/** Sum prorated fielding errors per 162 for field lineup slots (DH excluded). */
export function lineupErrorsPer162(entries: LineupEntry[]): number {
  let total = 0
  for (const { position, player } of entries) {
    if (position === 'DH') continue
    if (player.role !== 'hitter') continue
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
export function calculateRunPrevention(
  lineup: Lineup,
  formatId: RosterFormatId,
): RunPreventionBreakdown {
  const entries = lineupEntries(lineup, formatId)
  const players = entries.map((e) => e.player)
  const pitchers = players.filter(
    (p) => playerHasPitchingProfile(p) && p.role !== 'hitter',
  )
  const pitcherValue = avg(pitchers.map((p) => getPitchingRatings(p).era))
  const errorsTotal = lineupErrorsPer162(entries)
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
