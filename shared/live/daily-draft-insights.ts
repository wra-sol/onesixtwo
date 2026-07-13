import {
  DAILY_LINEUP_POSITIONS,
  playerEligibleForDailyPosition,
  type DailyLineup,
  type DailyLineupPosition,
} from './daily-roster'
import type { LivePlayer } from './live-types'

export type PositionFillCounts = Record<DailyLineupPosition, { filled: number; open: number }>

export function openPositionCounts(lineup: DailyLineup): PositionFillCounts {
  const counts = {} as PositionFillCounts
  for (const pos of DAILY_LINEUP_POSITIONS) {
    counts[pos] = lineup[pos] ? { filled: 1, open: 0 } : { filled: 0, open: 1 }
  }
  return counts
}

export function filledSlotCount(lineup: DailyLineup): number {
  return DAILY_LINEUP_POSITIONS.filter((pos) => lineup[pos] !== null).length
}

export function openPositions(lineup: DailyLineup): DailyLineupPosition[] {
  return DAILY_LINEUP_POSITIONS.filter((pos) => lineup[pos] === null)
}

export function eligiblePlayersForPosition(
  players: LivePlayer[],
  position: DailyLineupPosition,
): LivePlayer[] {
  return players.filter((p) => playerEligibleForDailyPosition(p, position))
}

export type EligibleCountByPosition = Record<DailyLineupPosition, number>

export function eligiblePoolByPosition(
  players: LivePlayer[],
  draftedPlayerIds: string[],
  opponentTeamId: number,
): EligibleCountByPosition {
  const drafted = new Set(draftedPlayerIds)
  const counts = {} as EligibleCountByPosition
  for (const pos of DAILY_LINEUP_POSITIONS) {
    counts[pos] = players.filter(
      (p) =>
        !drafted.has(p.id) &&
        p.teamId !== opponentTeamId &&
        playerEligibleForDailyPosition(p, pos),
    ).length
  }
  return counts
}

export type TeamUsage = {
  teamId: number
  teamAbbrev: string
  teamName: string
  used: boolean
  isOpponent: boolean
  remainingPlayers: number
}

export function teamUsage(
  players: LivePlayer[],
  draftedTeamIds: number[],
  opponentTeamId: number,
): TeamUsage[] {
  const usedTeams = new Set(draftedTeamIds)
  const byTeam = new Map<number, { teamAbbrev: string; teamName: string; count: number }>()
  for (const p of players) {
    const existing = byTeam.get(p.teamId)
    if (existing) existing.count += 1
    else byTeam.set(p.teamId, { teamAbbrev: p.teamAbbrev, teamName: p.teamName, count: 1 })
  }
  return Array.from(byTeam.entries())
    .map(([teamId, info]) => ({
      teamId,
      teamAbbrev: info.teamAbbrev,
      teamName: info.teamName,
      used: usedTeams.has(teamId),
      isOpponent: teamId === opponentTeamId,
      remainingPlayers: usedTeams.has(teamId) || teamId === opponentTeamId ? 0 : info.count,
    }))
    .sort((a, b) => a.teamAbbrev.localeCompare(b.teamAbbrev))
}

export type ScarceSlotHint = {
  position: DailyLineupPosition
  eligibleRemaining: number
}

export function scarceSlotHints(
  lineup: DailyLineup,
  players: LivePlayer[],
  draftedPlayerIds: string[],
  opponentTeamId: number,
  threshold = 2,
): ScarceSlotHint[] {
  const eligible = eligiblePoolByPosition(players, draftedPlayerIds, opponentTeamId)
  return openPositions(lineup)
    .map((position) => ({
      position,
      eligibleRemaining: eligible[position],
    }))
    .filter((hint) => hint.eligibleRemaining <= threshold)
    .sort((a, b) => a.eligibleRemaining - b.eligibleRemaining)
}
