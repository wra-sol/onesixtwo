import type { LivePlayer } from './live-types'
import {
  getArsenal,
  arsenalQualityFor,
  synthesizeBatterProfile,
  type BatterPitchProfile,
  type PitchFamily,
} from './pitch-profiles'
import { paProbabilities, type PaOutcomeType } from './pa-outcomes'

export type PitcherCondition = {
  /** Multipliers applied by fatigue/rest (default fresh: 1). */
  stuffMult: number
  commandMult: number
}

const FRESH: PitcherCondition = { stuffMult: 1, commandMult: 1 }

function g(grade: number | undefined, fallback = 50): number {
  return (grade ?? fallback) / 50
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * Context-sensitive pitch selection: pitchers reach for fastballs when
 * behind, breaking balls and offspeed with two strikes. Deterministic given
 * the same roll stream.
 */
function adjustedUsage(
  p: { family: PitchFamily; usage: number },
  balls: number,
  strikes: number,
): number {
  let w = p.usage
  if (balls > strikes) w *= p.family === 'fastball' ? 1.35 : 0.9
  if (strikes === 2) w *= p.family === 'fastball' ? 0.85 : 1.25
  return w
}

function selectFamily(
  player: LivePlayer,
  balls: number,
  strikes: number,
  random: () => number,
): PitchFamily {
  const arsenal = getArsenal(player)
  // Iterate arsenal order directly (deterministic by construction) — no
  // per-pitch allocations on the hot path.
  let total = 0
  for (const p of arsenal.pitches) {
    total += adjustedUsage(p, balls, strikes)
  }
  let acc = 0
  const roll = random()
  let fallback: PitchFamily = 'fastball'
  for (const p of arsenal.pitches) {
    fallback = p.family
    acc += adjustedUsage(p, balls, strikes) / total
    if (roll < acc) return p.family
  }
  return fallback
}

/**
 * Resolves one plate appearance pitch-by-pitch. Balls and strikeouts emerge
 * from counts; balls in play resolve against the same marginal outcome
 * table the legacy single-roll engine used, conditioned on the pitch family
 * the batter finally saw.
 *
 * Calibration contract: across many PAs this must reproduce the league
 * marginals (K ≈ 24%, BB ≈ 9%, ~4.8 runs/team/game, ~3.4 pitches/PA) —
 * pinned by the league harness test (count-engine.test.ts).
 */
export function resolvePlateAppearance(input: {
  batter: LivePlayer
  pitcher: LivePlayer
  catcherDefense: number
  condition?: PitcherCondition
  random: () => number
}): { outcome: PaOutcomeType; pitches: number; lastFamily: PitchFamily } {
  const { batter, pitcher, random } = input
  const condition = input.condition ?? FRESH
  const profile: BatterPitchProfile = synthesizeBatterProfile(batter)

  let balls = 0
  let strikes = 0
  let pitches = 0
  let lastFamily: PitchFamily = 'fastball'

  // Terminal-outcome targets from the legacy table, used to shape the
  // in-play distribution so league aggregates stay put.
  const marginals = paProbabilities(batter, pitcher, input.catcherDefense)

  while (true) {
    const family = selectFamily(pitcher, balls, strikes, random)
    lastFamily = family
    pitches += 1

    const quality = arsenalQualityFor(getArsenal(pitcher), family)
    const stuffEff = g(pitcher.grades.stuff) * condition.stuffMult
    const commandEff = g(pitcher.grades.command) * condition.commandMult
    const qNorm = g(quality)

    const contactHere = g(batter.grades.contact) * profile.contactMod[family]

    // Zone rate: command puts it on the plate; nasty quality lives just off
    // the edge where it can be chased.
    const inZone = clamp(
      0.47 + 0.10 * (commandEff - 1) - 0.05 * (qNorm - 1),
      0.33,
      0.63,
    )

    const locationRoll = random()
    if (locationRoll < inZone) {
      const swingZone = clamp(0.66 * Math.sqrt(profile.chaseMod), 0.48, 0.86)
      const swingRoll = random()
      if (swingRoll >= swingZone) {
        // Called strike.
        strikes += 1
        if (strikes >= 3) return finish('strikeout')
        continue
      }
      const whiff = clamp(0.092 * stuffEff * qNorm / Math.max(0.4, contactHere), 0.03, 0.34)
      const foul = 0.385
      const contactRoll = random()
      if (contactRoll < whiff) {
        strikes += 1
        if (strikes >= 3) return finish('strikeout')
        continue
      }
      if (contactRoll < whiff + foul) {
        if (strikes < 2) strikes += 1
        continue
      }
      return finish(resolveBallInPlay(family))
    }

    // Off the plate: chase or take.
    const chase = clamp(
      0.29 * profile.chaseMod * (qNorm / Math.max(0.4, contactHere)) ** 0.8,
      0.08,
      0.62,
    )
    const chaseRoll = random()
    if (chaseRoll >= chase) {
      balls += 1
      if (balls >= 4) return finish('walk')
      continue
    }
    const chaseWhiff = clamp(0.215 * stuffEff * qNorm / Math.max(0.4, contactHere), 0.08, 0.48)
    const chaseFoul = 0.345
    const contactRoll = random()
    if (contactRoll < chaseWhiff) {
      strikes += 1
      if (strikes >= 3) return finish('strikeout')
      continue
    }
    if (contactRoll < chaseWhiff + chaseFoul) {
      if (strikes < 2) strikes += 1
      continue
    }
    return finish(resolveBallInPlay(family))
  }

  function resolveBallInPlay(family: PitchFamily): PaOutcomeType {
    // Strip K/BB out of the marginal table, scale what remains by the
    // batter's damage profile against this family, renormalize.
    const raw: Array<[PaOutcomeType, number]> = [
      ['home_run', marginals.home_run * profile.powerMod[family] * 2.7],
      ['triple', marginals.triple * (family === 'offspeed' ? 1.1 : 1)],
      ['double', marginals.double * profile.powerMod[family] * 1.6],
      ['single', marginals.single * profile.contactMod[family] * 1.08],
      ['out', marginals.out],
    ]
    const total = raw.reduce((s, [, p]) => s + p, 0)
    let acc = 0
    const roll = random()
    for (const [outcome, p] of raw) {
      acc += p / total
      if (roll < acc) return outcome
    }
    return 'out'
  }

  function finish(outcome: PaOutcomeType) {
    return { outcome, pitches, lastFamily }
  }
}
