import type { BenchmarkLineupId } from './benchmarks'
import type { RosterFormatId } from './types'

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

/** Minimum projected wins (from team score) required to allow 162-0. Matches score 95 on the win curve. */
export const PERFECT_SEASON_EXPECTED_WINS = 150

export type PerfectSeasonGate = {
  minTeamScore: number
  minExpectedWins: number
  minRawWins: number
}

/** Format-tuned perfect-season gate — targets ~0.1% rate under optimal drafting. */
export function getPerfectSeasonGate(formatId: RosterFormatId): PerfectSeasonGate {
  if (formatId === 'dh-rp') {
    return {
      minTeamScore: PERFECT_SEASON_THRESHOLD,
      minExpectedWins: 149,
      minRawWins: SEASON_LENGTH - 2,
    }
  }
  if (formatId === 'dh' || formatId === 'rp') {
    return {
      minTeamScore: PERFECT_SEASON_THRESHOLD,
      minExpectedWins: 149,
      minRawWins: SEASON_LENGTH - 2,
    }
  }
  return {
    minTeamScore: PERFECT_SEASON_THRESHOLD,
    minExpectedWins: PERFECT_SEASON_EXPECTED_WINS,
    minRawWins: SEASON_LENGTH - 1,
  }
}

/** Volatility multiplier for stars-and-scrubs rosters. */
export const VOLATILITY_MODIFIER = 0.08

/** Games per simulated season. */
export const SEASON_LENGTH = 162

/** Starter counting-stat baseline for end-of-season display (30 starts). */
export const PITCHER_STARTS_PER_SEASON = 30

/** Relief appearance baseline paired with ip-per-appearance for STANDARD_RP_IP. */
export const STANDARD_RP_APPEARANCES = 70

/**
 * Relief counting-stat baseline IP for end-of-season display.
 * Derived from Lahman gs=0 relief cards: median(ip / reliefGames) × STANDARD_RP_APPEARANCES ≈ 38.
 * Re-run `npm run analyze:ratings` to recalibrate.
 */
export const STANDARD_RP_IP = 38

/** SP/RP blend when the roster format includes a relief slot. */
export const PITCHING_STARTER_WEIGHT = 0.72
export const PITCHING_RELIEF_WEIGHT = 0.28

/** Workload cap for a reliever miscast in the SP slot. */
export const NON_STARTER_SP_WORKLOAD_CAP = 32

/** Relief-only pitching staffs cannot carry a full rotation workload. */
export const RELIEF_ONLY_STAFF_WORKLOAD_MULTIPLIER = 0.35
export const RELIEF_ONLY_STAFF_WORKLOAD_CAP = 28

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
