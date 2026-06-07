import {
  RELIEF_ONLY_STAFF_WORKLOAD_CAP,
  RELIEF_ONLY_STAFF_WORKLOAD_MULTIPLIER,
  NON_STARTER_SP_WORKLOAD_CAP,
  PITCHING_RELIEF_WEIGHT,
  PITCHING_STARTER_WEIGHT,
  STANDARD_RP_APPEARANCES,
} from './calibration'
import { getPitchingRatings } from './player-ratings'
import {
  isReliefEligible,
  isStarterEligible,
  playerHasPitchingProfile,
  reliefProfileFromStats,
} from './player-eligibility'
import { getActiveLineupPositions, lineupEntries } from './roster-format'
import {
  PITCHER_RP_AVAILABILITY_PER_70_ANCHORS,
  PITCHER_RP_IP_PER_70_ANCHORS,
  scoreFromAnchors,
} from './rating-anchors'
import type { Lineup, LineupPosition, Player, RosterFormatId } from './types'

export type ReliefWorkloadInput = {
  gs?: number
  g?: number
  reliefGames?: number
  ip?: number
}

/** Relief workload from availability (usage rate) and durability (IP per appearance). */
export function reliefWorkloadFromStats(stats: ReliefWorkloadInput): number {
  const gs = stats.gs ?? 0
  const g = Math.max(stats.g ?? gs, 1)
  const reliefGames = stats.reliefGames ?? Math.max(0, g - gs)
  const ip = stats.ip ?? 0

  const availabilityPer70 =
    (reliefGames / g) * STANDARD_RP_APPEARANCES
  const durabilityPer70 =
    (ip / Math.max(reliefGames, 1)) * STANDARD_RP_APPEARANCES

  const availability = scoreFromAnchors(
    availabilityPer70,
    PITCHER_RP_AVAILABILITY_PER_70_ANCHORS,
  )
  const durability = scoreFromAnchors(
    durabilityPer70,
    PITCHER_RP_IP_PER_70_ANCHORS,
  )

  return Math.round(availability * 0.45 + durability * 0.55)
}

export function isReliefOnlyPitchingStaff(
  lineup: Lineup,
  formatId: RosterFormatId,
): boolean {
  const pitchingSlots = lineupEntries(lineup, formatId).filter(
    ({ position }) => position === 'SP' || position === 'RP',
  )
  if (pitchingSlots.length === 0) return false

  return pitchingSlots.every(
    ({ player }) =>
      playerHasPitchingProfile(player) &&
      isReliefEligible(player) &&
      !isStarterEligible(player) &&
      player.role !== 'two-way',
  )
}

function slotEffectiveWorkload(
  player: Player,
  position: LineupPosition,
): number {
  const base = getPitchingRatings(player).workload
  if (
    position === 'SP' &&
    !isStarterEligible(player) &&
    player.role !== 'two-way'
  ) {
    return Math.min(base, NON_STARTER_SP_WORKLOAD_CAP)
  }
  return base
}

/** Team workload grade — penalizes relief-only staffs and non-starters in the SP slot. */
export function teamWorkloadScore(
  lineup: Lineup,
  formatId: RosterFormatId,
): number {
  const hasRpSlot = getActiveLineupPositions(formatId).includes('RP')
  const entries = lineupEntries(lineup, formatId)

  const starterWorkloads: number[] = []
  const reliefWorkloads: number[] = []

  for (const { position, player } of entries) {
    if (!playerHasPitchingProfile(player)) continue
    const effective = slotEffectiveWorkload(player, position)
    if (position === 'SP') {
      starterWorkloads.push(effective)
    } else if (position === 'RP') {
      reliefWorkloads.push(effective)
    }
  }

  const avg = (values: number[]) =>
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 50

  let score = hasRpSlot
    ? avg(starterWorkloads) * PITCHING_STARTER_WEIGHT +
      avg(reliefWorkloads) * PITCHING_RELIEF_WEIGHT
    : avg(starterWorkloads)

  if (isReliefOnlyPitchingStaff(lineup, formatId)) {
    score = Math.min(
      score * RELIEF_ONLY_STAFF_WORKLOAD_MULTIPLIER,
      RELIEF_ONLY_STAFF_WORKLOAD_CAP,
    )
  }

  return Math.round(score)
}

/** Whether card stats reflect a relief-dominant profile for workload scoring. */
export function usesReliefWorkloadProfile(stats: ReliefWorkloadInput): boolean {
  const gs = stats.gs ?? 0
  const g = stats.g ?? gs
  const reliefGames = stats.reliefGames ?? Math.max(0, g - gs)
  return reliefProfileFromStats(gs, g, reliefGames)
}
