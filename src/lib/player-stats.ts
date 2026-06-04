import { createSeededRandom, hashSeed } from './simulation'
import {
  PITCHER_STARTS_PER_SEASON,
  STANDARD_RP_IP,
} from './calibration'
import { isReliefEligible, isStarterEligible } from './player-eligibility'
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
  'SV',
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

/** Prorate fielding errors to a 162-game season when source stats include them. */
export function seasonHitterErrors(stats: HitterStats): number | null {
  if (stats.errors == null) {
    return null
  }
  const games = Math.max(stats.fieldingGames ?? stats.g ?? 162, 1)
  return Math.round((stats.errors / games) * 162)
}

export function seasonStarterPitcherCounts(stats: PitcherStats): {
  so: number
  wins: number
} {
  const gs = Math.max(stats.gs ?? PITCHER_STARTS_PER_SEASON, 1)
  const factor = PITCHER_STARTS_PER_SEASON / gs
  return {
    so: Math.round(stats.so * factor),
    wins: Math.round(stats.wins * factor),
  }
}

export function seasonReliefPitcherCounts(stats: PitcherStats): {
  so: number
  wins: number
  saves: number
} {
  const ip = Math.max(stats.ip ?? STANDARD_RP_IP, 1)
  const factor = STANDARD_RP_IP / ip
  return {
    so: Math.round(stats.so * factor),
    wins: Math.round(stats.wins * factor),
    saves: Math.round((stats.saves ?? 0) * factor),
  }
}

/** @deprecated Use seasonStarterPitcherCounts or seasonPitcherCountsForSlot. */
export function seasonPitcherCounts(stats: PitcherStats): {
  so: number
  wins: number
} {
  return seasonStarterPitcherCounts(stats)
}

function usesReliefPitcherCounts(
  player: Player,
  position?: LineupPosition,
): boolean {
  if (position === 'RP') return true
  if (position === 'SP') return false
  return isReliefEligible(player) && !isStarterEligible(player)
}

export function seasonPitcherCountsForSlot(
  stats: PitcherStats,
  player: Player,
  position?: LineupPosition,
): {
  so: number
  wins: number
  saves?: number
} {
  if (usesReliefPitcherCounts(player, position)) {
    return seasonReliefPitcherCounts(stats)
  }
  return seasonStarterPitcherCounts(stats)
}

function shouldShowPitcherSaves(
  player: Player,
  position?: LineupPosition,
): boolean {
  if (position === 'RP') return true
  if (position === 'SP') return false
  return isReliefEligible(player) && !isStarterEligible(player)
}

function formatPitcherCountingLine(
  counts: { so: number; wins: number; saves?: number },
  player: Player,
  position?: LineupPosition,
): string {
  const base = `${formatCount(counts.so)} K · ${formatCount(counts.wins)} W`
  if (!shouldShowPitcherSaves(player, position)) return base
  if (counts.saves == null || counts.saves <= 0) return base
  return `${base} · ${formatCount(counts.saves)} SV`
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

function usesPitchingLine(
  player: Player,
  position: LineupPosition,
  profile?: 'batting' | 'pitching',
): boolean {
  if (profile === 'batting') return false
  if (profile === 'pitching') return player.role === 'pitcher' || player.role === 'two-way'
  if (player.role === 'pitcher') return true
  if (player.role === 'two-way') {
    return position === 'SP' || position === 'RP'
  }
  return false
}

function hitterStatsFor(player: Player): HitterStats {
  return (player.battingStats ?? player.stats) as HitterStats
}

function pitcherStatsFor(player: Player): PitcherStats {
  return (player.pitchingStats ?? player.stats) as PitcherStats
}

export function simulatedSeasonRates(
  player: Player,
  simulationSeed: SimulationSeed,
  position: LineupPosition,
  profile?: 'batting' | 'pitching',
): SimulatedHitterRates | SimulatedPitcherRates {
  const rng = createSeededRandom(
    hashSeed(`${simulationSeed}|${player.personId}|${position}|${profile ?? 'slot'}`),
  )

  if (usesPitchingLine(player, position, profile)) {
    const stats = pitcherStatsFor(player)
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

  const stats = hitterStatsFor(player)
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

function formatTwoWaySlashLine(player: Player): string {
  const bat = hitterStatsFor(player)
  const pit = pitcherStatsFor(player)
  const batLine =
    bat.obp && bat.slg
      ? `${bat.avg} / ${bat.obp} / ${bat.slg}`
      : `${bat.avg} AVG · ${bat.ops} OPS`
  return `${batLine} · ${pit.era} ERA · ${pit.whip} WHIP`
}

function formatTwoWayTotals(player: Player, position?: LineupPosition): string {
  const bat = hitterStatsFor(player)
  const counts = seasonHitterCounts(bat)
  const errors = seasonHitterErrors(bat)
  const batting = `${formatCount(counts.hr)} HR · ${formatCount(counts.rbi)} RBI · ${formatCount(counts.sb)} SB`
  const batLine =
    errors == null ? batting : `${batting} · ${formatCount(errors)} E`
  const pitCounts = seasonPitcherCountsForSlot(
    pitcherStatsFor(player),
    player,
    position,
  )
  const pitLine = `${formatCount(pitCounts.so)} K · ${formatCount(pitCounts.wins)} W`
  return `${batLine} · ${pitLine}`
}

function formatHitterSlashFromRates(rates: SimulatedHitterRates): string {
  if (rates.obp && rates.slg) {
    return `${rates.avg} / ${rates.obp} / ${rates.slg}`
  }
  return `${rates.avg} AVG · ${rates.ops} OPS`
}

export function formatPlayerSlashLine(
  player: Player,
  position?: LineupPosition,
): string {
  if (position && usesPitchingLine(player, position)) {
    const stats = pitcherStatsFor(player)
    return `${stats.era} ERA · ${stats.whip} WHIP`
  }
  if (player.role === 'pitcher') {
    const stats = pitcherStatsFor(player)
    return `${stats.era} ERA · ${stats.whip} WHIP`
  }
  if (player.role === 'two-way' && !position) {
    return formatTwoWaySlashLine(player)
  }

  const stats = hitterStatsFor(player)
  if (stats.obp && stats.slg) {
    return `${stats.avg} / ${stats.obp} / ${stats.slg}`
  }
  return `${stats.avg} AVG · ${stats.ops} OPS`
}

export function formatPlayerTotals(
  player: Player,
  position?: LineupPosition,
): string {
  if (position && usesPitchingLine(player, position)) {
    return formatPitcherCountingLine(
      seasonPitcherCountsForSlot(pitcherStatsFor(player), player, position),
      player,
      position,
    )
  }
  if (player.role === 'pitcher') {
    return formatPitcherCountingLine(
      seasonPitcherCountsForSlot(pitcherStatsFor(player), player, position),
      player,
      position,
    )
  }
  if (player.role === 'two-way' && !position) {
    return formatTwoWayTotals(player)
  }

  const stats = hitterStatsFor(player)
  const errors = seasonHitterErrors(stats)
  const counting = `${formatCount(stats.hr)} HR · ${formatCount(stats.rbi)} RBI · ${formatCount(stats.sb)} SB`
  return errors == null ? counting : `${counting} · ${formatCount(errors)} E`
}

export function formatSimulatedSlashLine(
  player: Player,
  simulationSeed: SimulationSeed,
  position: LineupPosition,
  profile?: 'batting' | 'pitching',
): string {
  const rates = simulatedSeasonRates(player, simulationSeed, position, profile)
  if (usesPitchingLine(player, position, profile)) {
    const p = rates as SimulatedPitcherRates
    return `${p.era} ERA · ${p.whip} WHIP`
  }
  return formatHitterSlashFromRates(rates as SimulatedHitterRates)
}

export function formatSimulatedTotals(
  player: Player,
  position?: LineupPosition,
  profile?: 'batting' | 'pitching',
): string {
  if (position && usesPitchingLine(player, position, profile)) {
    return formatPitcherCountingLine(
      seasonPitcherCountsForSlot(pitcherStatsFor(player), player, position),
      player,
      position,
    )
  }

  const stats = hitterStatsFor(player)
  const counts = seasonHitterCounts(stats)
  const errors = seasonHitterErrors(stats)
  const counting = `${formatCount(counts.hr)} HR · ${formatCount(counts.rbi)} RBI · ${formatCount(counts.sb)} SB`
  return errors == null ? counting : `${counting} · ${formatCount(errors)} E`
}

export function formatPlayerStats(player: Player): string {
  return `${formatPlayerSlashLine(player)} · ${formatPlayerTotals(player)}`
}

export function getPlayerStatSortValue(
  player: Player,
  label: PlayerStatSortLabel,
): number | null {
  if (player.role === 'hitter' || player.role === 'two-way') {
    const stats = hitterStatsFor(player)
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

  const stats = pitcherStatsFor(player)
  switch (label) {
    case 'ERA':
      return parseRate(stats.era)
    case 'WHIP':
      return parseRate(stats.whip)
    case 'K':
      return stats.so
    case 'W':
      return stats.wins
    case 'SV':
      return stats.saves ?? null
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
