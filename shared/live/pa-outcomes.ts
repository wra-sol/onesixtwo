import type { LivePlayer } from './live-types'

/**
 * Marginal plate-appearance outcome table — the calibration anchor. The
 * count-based engine (see count-engine.ts) shapes its per-pitch model so
 * league aggregates reproduce these rates.
 */

export function gradeNorm(grade: number | undefined, fallback = 50): number {
  return (grade ?? fallback) / 50
}

export function platoonModifier(
  batter: LivePlayer,
  pitcher: LivePlayer,
): number {
  const bat = batter.batSide ?? 'R'
  const hand = pitcher.pitchHand ?? 'R'
  if (bat === 'S') return 1
  if (bat === 'L' && hand === 'R') return 1.03
  if (bat === 'R' && hand === 'L') return 1.03
  if (bat === 'L' && hand === 'L') return 0.97
  if (bat === 'R' && hand === 'R') return 0.97
  return 1
}

export function paProbabilities(batter: LivePlayer, pitcher: LivePlayer, defense: number) {
  const contact = gradeNorm(batter.grades.contact) * platoonModifier(batter, pitcher)
  const power = gradeNorm(batter.grades.power)
  const stuff = gradeNorm(pitcher.grades.stuff)
  const command = gradeNorm(pitcher.grades.command)
  const defenseFactor = gradeNorm(defense, 50)

  const kRate = Math.max(0.08, Math.min(0.35, 0.22 * stuff / contact))
  const bbRate = Math.max(0.04, Math.min(0.18, 0.08 * (1 / command) * contact))
  const hrRate = Math.max(0.01, Math.min(0.12, 0.04 * power * (2 - stuff) * 0.5))
  const tripleRate = 0.004 * gradeNorm(batter.grades.speed)
  const doubleRate = Math.max(0.02, Math.min(0.08, 0.04 * power * 0.8))
  const singleRate = Math.max(
    0.1,
    0.28 * contact * (2 - stuff) * defenseFactor * 0.4,
  )
  const outRate = Math.max(
    0.2,
    1 - kRate - bbRate - hrRate - tripleRate - doubleRate - singleRate,
  )

  const total = kRate + bbRate + hrRate + tripleRate + doubleRate + singleRate + outRate
  return {
    strikeout: kRate / total,
    walk: bbRate / total,
    home_run: hrRate / total,
    triple: tripleRate / total,
    double: doubleRate / total,
    single: singleRate / total,
    out: outRate / total,
  }
}

export type PaOutcomeType =
  | 'strikeout'
  | 'walk'
  | 'home_run'
  | 'triple'
  | 'double'
  | 'single'
  | 'out'

export function pickOutcome(
  probs: ReturnType<typeof paProbabilities>,
  random: () => number,
): PaOutcomeType {
  const roll = random()
  let acc = 0
  const entries: Array<[PaOutcomeType, number]> = [
    ['strikeout', probs.strikeout],
    ['walk', probs.walk],
    ['home_run', probs.home_run],
    ['triple', probs.triple],
    ['double', probs.double],
    ['single', probs.single],
    ['out', probs.out],
  ]
  for (const [type, p] of entries) {
    acc += p
    if (roll < acc) return type
  }
  return 'out'
}
