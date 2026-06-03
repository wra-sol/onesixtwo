import { createSeededRandom, hashSeed } from './simulation'
import type {
  HitterStats,
  LineupPosition,
  PitcherStats,
  Player,
  SimulationSeed,
} from './types'

export const PLAYER_STAT_SORT_LABELS = [
  'Random',
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

export const SIMULATED_SEASON_STAT_NOTE = 'Simulated season'

function parseRate(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '.000'
  return value >= 1
    ? '.999'
    : `.${Math.min(999, Math.round(value * 1000))
        .toString()
        .padStart(3, '0')}`
}

function formatOpsRate(value: number): string {
  return value.toFixed(3).replace(/^0/, '')
}

function formatEraRate(value: number): string {
  return value.toFixed(2)
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function uniformNoise(rng: () => number, amplitude: number): number {
  return (rng() * 2 - 1) * amplitude
}

export function seasonHitterCounts(stats: HitterStats): {
  hr: number
  rbi: number
  sb: number
} {
  const g = Math.max(stats.g ?? 162, 1)
  const factor = 162 / g
  return {
    hr: Math.round(stats.hr * factor),
    rbi: Math.round(stats.rbi * factor),
    sb: Math.round(stats.sb * factor),
  }
}

export function seasonPitcherCounts(stats: PitcherStats): {
  so: number
  wins: number
} {
  const gs = Math.max(stats.gs ?? 30, 1)
  const factor = 30 / gs
  return {
    so: Math.round(stats.so * factor),
    wins: Math.round(stats.wins * factor),
  }
}

export type SimulatedHitterRates = {
  avg: string
  obp?: string
  slg?: string
  ops: string
}

export type SimulatedPitcherRates = {
  era: string
  whip: string
}

export function simulatedSeasonRates(
  player: Player,
  simulationSeed: SimulationSeed,
  position: LineupPosition,
): SimulatedHitterRates | SimulatedPitcherRates {
  const rng = createSeededRandom(
    hashSeed(`${simulationSeed}|${player.personId}|${position}`),
  )

  if (player.role === 'pitcher') {
    const stats = player.stats as PitcherStats
    const era = clamp(
      parseRate(stats.era) + uniformNoise(rng, 0.35),
      1.5,
      7,
    )
    const whip = clamp(
      parseRate(stats.whip) + uniformNoise(rng, 0.08),
      0.85,
      2,
    )
    return { era: formatEraRate(era), whip: formatEraRate(whip) }
  }

  const stats = player.stats as HitterStats
  if (stats.obp && stats.slg) {
    const avg = clamp(
      parseRate(stats.avg) + uniformNoise(rng, 0.012),
      0.15,
      0.4,
    )
    let obp = clamp(
      parseRate(stats.obp) + uniformNoise(rng, 0.015),
      avg,
      0.55,
    )
    const slg = clamp(
      parseRate(stats.slg) + uniformNoise(rng, 0.015),
      avg,
      0.75,
    )
    obp = Math.max(obp, avg)
    const ops = obp + slg
    return {
      avg: formatRate(avg),
      obp: formatRate(obp),
      slg: formatRate(slg),
      ops: formatOpsRate(ops),
    }
  }

  const avg = clamp(
    parseRate(stats.avg) + uniformNoise(rng, 0.012),
    0.15,
    0.4,
  )
  const ops = clamp(
    parseRate(stats.ops) + uniformNoise(rng, 0.04),
    0.5,
    1.2,
  )
  return { avg: formatRate(avg), ops: formatOpsRate(ops) }
}

function formatHitterSlashFromRates(rates: SimulatedHitterRates): string {
  if (rates.obp && rates.slg) {
    return `${rates.avg} / ${rates.obp} / ${rates.slg}`
  }
  return `${rates.avg} AVG · ${rates.ops} OPS`
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

export function formatSimulatedSlashLine(
  player: Player,
  simulationSeed: SimulationSeed,
  position: LineupPosition,
): string {
  const rates = simulatedSeasonRates(player, simulationSeed, position)
  if (player.role === 'pitcher') {
    const p = rates as SimulatedPitcherRates
    return `${p.era} ERA · ${p.whip} WHIP`
  }
  return formatHitterSlashFromRates(rates as SimulatedHitterRates)
}

export function formatSimulatedTotals(player: Player): string {
  if (player.role === 'pitcher') {
    const counts = seasonPitcherCounts(player.stats as PitcherStats)
    return `${formatCount(counts.so)} K · ${formatCount(counts.wins)} W`
  }

  const counts = seasonHitterCounts(player.stats as HitterStats)
  return `${formatCount(counts.hr)} HR · ${formatCount(counts.rbi)} RBI · ${formatCount(counts.sb)} SB`
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

function randomSortKey(player: Player, seed: string): number {
  const rng = createSeededRandom(hashSeed(`${seed}|${player.id}`))
  return rng()
}

export function comparePlayersRandom(
  a: Player,
  b: Player,
  seed: string,
): number {
  return randomSortKey(a, seed) - randomSortKey(b, seed)
}
