import { PLAYERS } from '../data'
import { createEmptyLineup } from './roster-format'
import {
  type Lineup,
  type LineupPosition,
  type Player,
} from './types'

export type BenchmarkLineupId = 'mediocre' | 'great' | 'elite' | 'nearPerfect'

const FILL_ORDER: LineupPosition[] = [
  'C',
  'SP',
  'SS',
  'CF',
  'RF',
  'LF',
  '2B',
  '3B',
  '1B',
]

const TIER_BANDS: Record<
  BenchmarkLineupId,
  { min: number; max: number; preferHigh: boolean }
> = {
  mediocre: { min: 62, max: 68, preferHigh: false },
  great: { min: 66, max: 74, preferHigh: true },
  elite: { min: 74, max: 88, preferHigh: true },
  nearPerfect: { min: 82, max: 95, preferHigh: true },
}

function inBand(player: Player, min: number, max: number): boolean {
  const o = player.ratings.overall
  return o >= min && o <= max
}

function sortCandidates(
  players: Player[],
  preferHigh: boolean,
): Player[] {
  return [...players].sort((a, b) =>
    preferHigh
      ? b.ratings.overall - a.ratings.overall
      : a.ratings.overall - b.ratings.overall,
  )
}

export function buildBenchmarkLineup(id: BenchmarkLineupId): Lineup {
  const { min, max, preferHigh } = TIER_BANDS[id]
  const lineup = createEmptyLineup()
  const usedPerson = new Set<string>()

  const tryFill = (poolMin: number, poolMax: number): void => {
    const pool = PLAYERS.filter((p) => inBand(p, poolMin, poolMax))
    for (const position of FILL_ORDER) {
      if (lineup[position] !== null) continue
      const candidates = sortCandidates(
        pool.filter(
          (p) =>
            !usedPerson.has(p.personId) && p.positions.includes(position),
        ),
        preferHigh,
      )
      const pick = candidates[0]
      if (pick) {
        lineup[position] = pick
        usedPerson.add(pick.personId)
      }
    }
  }

  tryFill(min, max)

  if (FILL_ORDER.some((pos) => lineup[pos] === null)) {
    tryFill(min - 4, max + 4)
  }

  const remaining = FILL_ORDER.filter((pos) => lineup[pos] === null)
  if (remaining.length > 0) {
    const fallback = sortCandidates(PLAYERS, preferHigh)
    for (const position of remaining) {
      const pick = fallback.find(
        (p) =>
          !usedPerson.has(p.personId) && p.positions.includes(position),
      )
      if (pick) {
        lineup[position] = pick
        usedPerson.add(pick.personId)
      }
    }
  }

  return lineup
}

export const BENCHMARK_WIN_RANGES: Record<
  BenchmarkLineupId,
  { min: number; max: number }
> = {
  mediocre: { min: 65, max: 100 },
  great: { min: 95, max: 125 },
  elite: { min: 110, max: 162 },
  nearPerfect: { min: 130, max: 162 },
}
