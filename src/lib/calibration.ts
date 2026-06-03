import type { BenchmarkLineupId } from './benchmarks'

/**
 * Simulation calibration contract:
 * - Roster quality sets the baseline (expected wins from team score).
 * - RNG can move the season outcome, but cannot erase roster quality.
 * - Perfect seasons remain rare and require elite lineups (team score ~95+).
 * - Weak or ordinary rosters cannot spike into 162-0.
 * - The first result is stable enough to share (seeded from lineup).
 * - Re-simulation variance is bounded by tier and roster volatility.
 */

/** Per-game win probability variance from seeded RNG. */
export const PER_GAME_VARIANCE = 0.08

/** Maximum wins initial simulation can swing from expected wins. */
export const INITIAL_SEASON_VARIANCE = 12

/** Extra simulation swing allowed for elite team scores (90+). */
export const ELITE_SEASON_VARIANCE = 16

/** Maximum wins a reroll can swing from the initial seeded result. */
export const MAX_REROLL_SWING = 18

/** Team score at or above which a perfect season is allowed (with strong RNG). */
export const PERFECT_SEASON_THRESHOLD = 95

/** Minimum team score required for any perfect-season outcome. */
export const PERFECT_SEASON_MIN_SCORE = 93

/** Volatility multiplier for stars-and-scrubs rosters. */
export const VOLATILITY_MODIFIER = 0.08

/** Games per simulated season. */
export const SEASON_LENGTH = 162

/** Segment boundaries for future granular notes (games 1-54, 55-108, 109-162). */
export const SEASON_SEGMENTS = {
  early: { start: 0, end: 54 },
  middle: { start: 54, end: 108 },
  late: { start: 108, end: 162 },
} as const

export type SeasonSegment = keyof typeof SEASON_SEGMENTS

/** Expected win bands per benchmark tier — used for test calibration. */
export const BENCHMARK_EXPECTATIONS: Record<
  BenchmarkLineupId,
  {
    tierLabel: string
    winBand: { min: number; max: number }
    maxRerollSwing: number
    canReachPerfect: boolean
  }
> = {
  mediocre: {
    tierLabel: 'Rebuild',
    winBand: { min: 55, max: 100 },
    maxRerollSwing: 12,
    canReachPerfect: false,
  },
  great: {
    tierLabel: 'Contender',
    winBand: { min: 90, max: 130 },
    maxRerollSwing: 15,
    canReachPerfect: false,
  },
  elite: {
    tierLabel: 'Dynasty',
    winBand: { min: 110, max: 162 },
    maxRerollSwing: 18,
    canReachPerfect: false,
  },
  nearPerfect: {
    tierLabel: 'Dynasty',
    winBand: { min: 130, max: 162 },
    maxRerollSwing: 18,
    canReachPerfect: true,
  },
}

/** UI copy for simulation explanation. */
export const SIMULATION_EXPLANATION =
  'Roster quality sets the baseline; lineup defense can trim run prevention; simulation variance decides the season.'
