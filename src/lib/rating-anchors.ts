/** Percentile-calibrated tier anchors for 0–100 category ratings. */

export type RatingAnchor = { value: number; score: number }

export const RATING_FLOOR = 50
export const RATING_CEILING = 100

/** Linear interpolation between sorted anchors. */
export function scoreFromAnchors(
  value: number,
  anchors: RatingAnchor[],
  options?: { lowerIsBetter?: boolean; floor?: number; ceiling?: number },
): number {
  const floor = options?.floor ?? RATING_FLOOR
  const ceiling = options?.ceiling ?? RATING_CEILING
  const lowerIsBetter = options?.lowerIsBetter ?? false

  const sorted = [...anchors].sort((a, b) =>
    lowerIsBetter ? b.value - a.value : a.value - b.value,
  )

  if (sorted.length === 0) return floor

  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!

  if (lowerIsBetter) {
    if (value >= first.value) return first.score
    if (value <= last.value) return last.score
  } else {
    if (value <= first.value) return first.score
    if (value >= last.value) return last.score
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i]!
    const right = sorted[i + 1]!
    const inRange = lowerIsBetter
      ? value <= left.value && value >= right.value
      : value >= left.value && value <= right.value
    if (!inRange) continue

    const span = right.value - left.value
    if (span === 0) return left.score
    const t = (value - left.value) / span
    const score = left.score + t * (right.score - left.score)
    return Math.round(Math.max(floor, Math.min(ceiling, score)))
  }

  return floor
}

/** Hitter tiers from generated-card percentile analysis (1960s–2020s pool). */
export const HITTER_AVG_ANCHORS: RatingAnchor[] = [
  { value: 0.239, score: 50 },
  { value: 0.252, score: 60 },
  { value: 0.267, score: 70 },
  { value: 0.283, score: 80 },
  { value: 0.297, score: 90 },
  { value: 0.323, score: 100 },
]

export const HITTER_OPS_ANCHORS: RatingAnchor[] = [
  { value: 0.616, score: 50 },
  { value: 0.657, score: 60 },
  { value: 0.702, score: 70 },
  { value: 0.752, score: 80 },
  { value: 0.807, score: 90 },
  { value: 0.918, score: 100 },
]

export const HITTER_HR_PER_162_ANCHORS: RatingAnchor[] = [
  { value: 7.6, score: 50 },
  { value: 12.7, score: 60 },
  { value: 19.3, score: 70 },
  { value: 26.3, score: 80 },
  { value: 33.0, score: 90 },
  { value: 44.7, score: 100 },
]

export const HITTER_RBI_PER_162_ANCHORS: RatingAnchor[] = [
  { value: 50.8, score: 50 },
  { value: 62.9, score: 60 },
  { value: 77.3, score: 70 },
  { value: 91.6, score: 80 },
  { value: 105.0, score: 90 },
  { value: 126.3, score: 100 },
]

export const HITTER_SB_PER_162_ANCHORS: RatingAnchor[] = [
  { value: 1.0, score: 50 },
  { value: 2.6, score: 60 },
  { value: 6.7, score: 70 },
  { value: 14.6, score: 80 },
  { value: 26.6, score: 90 },
  { value: 56.7, score: 100 },
]

/** Pitcher tiers — lower ERA/WHIP is better. */
export const PITCHER_ERA_ANCHORS: RatingAnchor[] = [
  { value: 4.4, score: 50 },
  { value: 4.04, score: 60 },
  { value: 3.65, score: 70 },
  { value: 3.24, score: 80 },
  { value: 2.87, score: 90 },
  { value: 2.31, score: 100 },
]

export const PITCHER_WHIP_ANCHORS: RatingAnchor[] = [
  { value: 1.41, score: 50 },
  { value: 1.34, score: 60 },
  { value: 1.27, score: 70 },
  { value: 1.19, score: 80 },
  { value: 1.11, score: 90 },
  { value: 0.95, score: 100 },
]

export const PITCHER_K9_ANCHORS: RatingAnchor[] = [
  { value: 4.5, score: 50 },
  { value: 5.3, score: 60 },
  { value: 6.5, score: 70 },
  { value: 7.9, score: 80 },
  { value: 9.5, score: 90 },
  { value: 12.1, score: 100 },
]

/** Innings per 30 games started — decade-card durability proxy. */
export const PITCHER_IP_PER_30GS_ANCHORS: RatingAnchor[] = [
  { value: 172, score: 50 },
  { value: 184, score: 60 },
  { value: 197, score: 70 },
  { value: 212, score: 80 },
  { value: 229, score: 90 },
  { value: 377, score: 100 },
]

/** Relief usage rate prorated to a 70-appearance season (reliefGames / g × 70). */
export const PITCHER_RP_AVAILABILITY_PER_70_ANCHORS: RatingAnchor[] = [
  { value: 25, score: 50 },
  { value: 35, score: 60 },
  { value: 45, score: 70 },
  { value: 55, score: 80 },
  { value: 62, score: 90 },
  { value: 70, score: 100 },
]

/** Relief IP prorated to 70 appearances (ip / reliefGames × 70). */
export const PITCHER_RP_IP_PER_70_ANCHORS: RatingAnchor[] = [
  { value: 22, score: 50 },
  { value: 30, score: 60 },
  { value: 38, score: 70 },
  { value: 48, score: 80 },
  { value: 58, score: 90 },
  { value: 75, score: 100 },
]

/** Saves prorated to a 70-relief-appearance season. */
export const PITCHER_SAVES_PER_70_RP_ANCHORS: RatingAnchor[] = [
  { value: 8, score: 50 },
  { value: 14, score: 60 },
  { value: 20, score: 70 },
  { value: 26, score: 80 },
  { value: 32, score: 90 },
  { value: 42, score: 100 },
]

/** Lineup total errors per 162 — higher values subtract more from run prevention. */
export const LINEUP_ERRORS_PENALTY_ANCHORS: RatingAnchor[] = [
  { value: 67, score: 0 },
  { value: 80, score: 3 },
  { value: 92, score: 6 },
  { value: 107, score: 9 },
  { value: 123, score: 12 },
]

export const MAX_LINEUP_ERROR_PENALTY = 12

export function per162(count: number, games: number): number {
  const g = Math.max(games, 1)
  return (count / g) * 162
}

export function parseRate(value: string): number {
  const trimmed = value.trim()
  if (trimmed.startsWith('.')) return Number.parseFloat(`0${trimmed}`)
  return Number.parseFloat(trimmed)
}

export function errorsPer162(errors: number, fieldingGames: number): number {
  return per162(errors, fieldingGames)
}

/** Map lineup error total to penalty points subtracted from run prevention. */
export function lineupErrorPenalty(lineupErrorsPer162: number): number {
  const penalty = scoreFromAnchors(lineupErrorsPer162, LINEUP_ERRORS_PENALTY_ANCHORS, {
    floor: 0,
    ceiling: MAX_LINEUP_ERROR_PENALTY,
  })
  return Math.min(MAX_LINEUP_ERROR_PENALTY, Math.max(0, penalty))
}
