import type { HitterStats, PitcherStats, Player } from './types'

export const PLAYER_STAT_SORT_LABELS = [
  'AVG',
  'OPS',
  'HR',
  'RBI',
  'SB',
  'ERA',
  'WHIP',
  'K',
  'W',
] as const

export type PlayerStatSortLabel = (typeof PLAYER_STAT_SORT_LABELS)[number]

function parseRate(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatPlayerSlashLine(player: Player): string {
  if (player.role === 'pitcher') {
    const stats = player.stats as PitcherStats
    return `${stats.era} ERA · ${stats.whip} WHIP`
  }

  const stats = player.stats as HitterStats
  if (stats.obp && stats.slg) {
    return `${stats.avg} / ${stats.obp} / ${stats.slg}`
  }
  return `${stats.avg} AVG · ${stats.ops} OPS`
}

export function formatPlayerTotals(player: Player): string {
  if (player.role === 'pitcher') {
    const stats = player.stats as PitcherStats
    return `${formatCount(stats.so)} K · ${formatCount(stats.wins)} W`
  }

  const stats = player.stats as HitterStats
  return `${formatCount(stats.hr)} HR · ${formatCount(stats.rbi)} RBI · ${formatCount(stats.sb)} SB`
}

export function formatPlayerStats(player: Player): string {
  return `${formatPlayerSlashLine(player)} · ${formatPlayerTotals(player)}`
}

export function getPlayerStatSortValue(
  player: Player,
  label: PlayerStatSortLabel,
): number | null {
  if (player.role === 'hitter') {
    const stats = player.stats as HitterStats
    switch (label) {
      case 'AVG':
        return parseRate(stats.avg)
      case 'OPS':
        return parseRate(stats.ops)
      case 'HR':
        return stats.hr
      case 'RBI':
        return stats.rbi
      case 'SB':
        return stats.sb
      default:
        return null
    }
  }

  const stats = player.stats as PitcherStats
  switch (label) {
    case 'ERA':
      return parseRate(stats.era)
    case 'WHIP':
      return parseRate(stats.whip)
    case 'K':
      return stats.so
    case 'W':
      return stats.wins
    default:
      return null
  }
}

export function comparePlayersByStat(
  a: Player,
  b: Player,
  label: PlayerStatSortLabel,
): number {
  const aValue = getPlayerStatSortValue(a, label)
  const bValue = getPlayerStatSortValue(b, label)
  if (aValue === null && bValue === null) {
    return 0
  }
  if (aValue === null) {
    return 1
  }
  if (bValue === null) {
    return -1
  }

  const lowerIsBetter = label === 'ERA' || label === 'WHIP'
  return lowerIsBetter ? aValue - bValue : bValue - aValue
}
