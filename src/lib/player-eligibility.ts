import type { LineupPosition, PitcherStats, Player, RosterFormatId } from './types'
import { getActiveLineupPositions } from './roster-format'

export function playerHasBattingProfile(player: Player): boolean {
  if (player.role === 'pitcher') return false
  if (player.role === 'hitter' || player.role === 'two-way') return true
  return Boolean(player.battingStats)
}

export function playerHasPitchingProfile(player: Player): boolean {
  if (player.role === 'pitcher' || player.role === 'two-way') return true
  return Boolean(player.pitchingStats)
}

export function reliefProfileFromStats(
  gs: number,
  g: number,
  reliefGames?: number,
): boolean {
  const relief = reliefGames ?? Math.max(0, g - gs)
  return relief >= 20 || relief > gs
}

export function starterProfileFromStats(
  gs: number,
  g: number,
  reliefGames?: number,
): boolean {
  const relief = reliefGames ?? Math.max(0, g - gs)
  return gs >= 20 || gs > relief
}

function pitcherStatsForEligibility(player: Player): PitcherStats | null {
  const stats =
    player.pitchingStats ??
    (player.role === 'pitcher' ? player.stats : null)
  if (!stats || !('era' in stats)) return null
  return stats
}

export function isReliefEligible(player: Player): boolean {
  if (!playerHasPitchingProfile(player)) return false
  const stats = pitcherStatsForEligibility(player)
  if (!stats) return false
  const gs = stats.gs ?? 0
  const g = stats.g ?? gs
  const reliefGames = stats.reliefGames ?? Math.max(0, g - gs)
  return reliefProfileFromStats(gs, g, reliefGames)
}

export function isStarterEligible(player: Player): boolean {
  if (!playerHasPitchingProfile(player)) return false
  const stats = pitcherStatsForEligibility(player)
  if (!stats) return false
  const gs = stats.gs ?? 0
  const g = stats.g ?? gs
  const reliefGames = stats.reliefGames ?? Math.max(0, g - gs)
  return starterProfileFromStats(gs, g, reliefGames)
}

/** Positions this card may occupy given roster format. */
export function getPlayerEligiblePositions(
  player: Player,
  formatId: RosterFormatId,
): LineupPosition[] {
  const active = new Set(getActiveLineupPositions(formatId))
  const out = new Set<LineupPosition>()

  const batting = playerHasBattingProfile(player)
  const pitching = playerHasPitchingProfile(player)

  if (batting) {
    for (const pos of player.positions) {
      if (pos !== 'SP' && pos !== 'RP' && active.has(pos)) {
        out.add(pos)
      }
    }
    if (active.has('DH')) {
      out.add('DH')
    }
  }

  if (pitching) {
    if (
      active.has('SP') &&
      (player.positions.includes('SP') ||
        isStarterEligible(player) ||
        player.role !== 'hitter')
    ) {
      out.add('SP')
    }
    if (active.has('RP') && (isReliefEligible(player) || player.positions.includes('RP'))) {
      out.add('RP')
    }
  }

  return [...out]
}
