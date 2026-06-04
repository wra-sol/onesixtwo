import {
  PITCHING_RELIEF_WEIGHT,
  PITCHING_STARTER_WEIGHT,
} from './calibration'
import { getPitchingRatings } from './player-ratings'
import { playerHasPitchingProfile } from './player-eligibility'
import { getActiveLineupPositions, lineupEntries } from './roster-format'
import type { Lineup, Player, PlayerRatings, RosterFormatId } from './types'

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

export function pitchingContributors(
  lineup: Lineup,
  formatId: RosterFormatId,
): {
  starters: Player[]
  relievers: Player[]
  all: Player[]
} {
  const entries = lineupEntries(lineup, formatId)
  const starters: Player[] = []
  const relievers: Player[] = []

  for (const { position, player } of entries) {
    if (!playerHasPitchingProfile(player)) continue
    if (position === 'SP') {
      starters.push(player)
    } else if (position === 'RP') {
      relievers.push(player)
    }
  }

  const all: Player[] = []
  const allSeen = new Set<string>()
  for (const p of [...starters, ...relievers]) {
    if (allSeen.has(p.personId)) continue
    allSeen.add(p.personId)
    all.push(p)
  }

  for (const { player } of entries) {
    if (player.role !== 'two-way' || allSeen.has(player.personId)) continue
    allSeen.add(player.personId)
    all.push(player)
  }

  return { starters, relievers, all }
}

export function pitcherComponentScore(players: Player[]): number {
  if (players.length === 0) return 50
  const ratings = players.map(getPitchingRatings)
  return Math.round(
    avg(ratings.map((r) => r.era)) * 0.35 +
      avg(ratings.map((r) => r.whip)) * 0.25 +
      avg(ratings.map((r) => r.strikeouts)) * 0.25 +
      avg(ratings.map((r) => r.workload)) * 0.15,
  )
}

/** RP slot score — closers get extra value from save totals. */
export function reliefComponentScore(players: Player[]): number {
  if (players.length === 0) return 50
  const ratings = players.map(getPitchingRatings)
  return Math.round(
    avg(ratings.map((r) => r.era)) * 0.25 +
      avg(ratings.map((r) => r.whip)) * 0.2 +
      avg(ratings.map((r) => r.strikeouts)) * 0.2 +
      avg(ratings.map((r) => r.saves)) * 0.35,
  )
}

function avgRatingForPlayers(
  players: Player[],
  pick: (ratings: PlayerRatings) => number,
): number {
  if (players.length === 0) return 50
  return avg(players.map((p) => pick(getPitchingRatings(p))))
}

/** Blend SP/RP slot ratings (72/28 when RP slot exists). */
export function blendedPitchingRating(
  lineup: Lineup,
  formatId: RosterFormatId,
  pick: (ratings: PlayerRatings) => number,
): number {
  const pitching = pitchingContributors(lineup, formatId)
  const hasRpSlot = getActiveLineupPositions(formatId).includes('RP')

  if (!hasRpSlot) {
    return avgRatingForPlayers(pitching.starters, pick)
  }

  const starterScore = avgRatingForPlayers(pitching.starters, pick)
  const reliefScore = avgRatingForPlayers(pitching.relievers, pick)
  return (
    starterScore * PITCHING_STARTER_WEIGHT + reliefScore * PITCHING_RELIEF_WEIGHT
  )
}
