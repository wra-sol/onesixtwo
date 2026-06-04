import type { LineupPosition, PitcherStats, Player, RosterFormatId } from './types'
import { getActiveLineupPositions } from './roster-format'

export function playerHasBattingProfile(player: Player): boolean {
  return player.role === 'hitter' || player.role === 'two-way'
}

export function playerHasPitchingProfile(player: Player): boolean {
  return player.role === 'pitcher' || player.role === 'two-way'
}

const PITCHING_LINEUP_POSITIONS = new Set<LineupPosition>(['SP', 'RP'])

/** Positions shown on cards — pitchers are SP/RP only; hitters omit pitching slots. */
export function getDisplayPositions(player: Player): LineupPosition[] {
  if (player.role === 'pitcher') {
    const pitching = player.positions.filter((pos) =>
      PITCHING_LINEUP_POSITIONS.has(pos),
    )
    return pitching.length > 0 ? pitching : ['SP']
  }
  if (player.role === 'hitter') {
    return player.positions.filter((pos) => !PITCHING_LINEUP_POSITIONS.has(pos))
  }
  return player.positions
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

/** Relief-dominant profile — used for bucket RP quotas (excludes starter-heavy swing usage). */
export function isDedicatedReliefEligible(player: Player): boolean {
  if (!playerHasPitchingProfile(player)) return false
  const stats = pitcherStatsForEligibility(player)
  if (!stats) return false
  const gs = stats.gs ?? 0
  const g = stats.g ?? gs
  const reliefGames = stats.reliefGames ?? Math.max(0, g - gs)
  return reliefGames >= 20 && reliefGames > gs
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

/** Whether a card's profile covers a lineup position for bucket coverage checks. */
export function playerCoversLineupPosition(
  player: Player,
  position: LineupPosition,
): boolean {
  if (position === 'SP') {
    return (
      player.positions.includes('SP') ||
      isStarterEligible(player) ||
      player.role === 'pitcher' ||
      player.role === 'two-way'
    )
  }
  if (position === 'RP') {
    return player.positions.includes('RP') || isReliefEligible(player)
  }
  return player.positions.includes(position)
}

/** Positions this card may occupy given roster format. */
export function getPlayerEligiblePositions(
  player: Player,
  formatId: RosterFormatId,
): LineupPosition[] {
  const active = new Set(getActiveLineupPositions(formatId))
  const out = new Set<LineupPosition>()

  const canBat = playerHasBattingProfile(player)
  const canPitch = playerHasPitchingProfile(player)

  if (canBat) {
    for (const pos of player.positions) {
      if (pos !== 'SP' && pos !== 'RP' && active.has(pos)) {
        out.add(pos)
      }
    }
    if (active.has('DH')) {
      out.add('DH')
    }
  }

  if (canPitch) {
    if (
      active.has('SP') &&
      (player.positions.includes('SP') ||
        isStarterEligible(player) ||
        player.role === 'pitcher' ||
        player.role === 'two-way')
    ) {
      out.add('SP')
    }
    if (active.has('RP') && (isReliefEligible(player) || player.positions.includes('RP'))) {
      out.add('RP')
    }
  }

  return [...out]
}
