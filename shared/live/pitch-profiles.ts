import { hashSeed } from './rng'
import type { LivePlayer } from './live-types'

/**
 * Pitch-level player attributes for the count-based engine.
 *
 * Data model (hybrid, per ADR to come): a pitcher's real arsenal rides the
 * snapshot from MLB when tracked; every other case — all legends, all batter
 * profiles, any pitcher without data — is synthesized deterministically from
 * existing grades and handedness. Same player in → same profile out, always,
 * so season seeds keep replaying identical seasons.
 */

export type PitchFamily = 'fastball' | 'breaking' | 'offspeed'

export const PITCH_FAMILIES: readonly PitchFamily[] = [
  'fastball',
  'breaking',
  'offspeed',
]

export type ArsenalPitch = {
  family: PitchFamily
  /** Share of pitches thrown; all pitches sum to 1. */
  usage: number
  /** Per-pitch quality on the same scale as grades (~20-80). */
  quality: number
}

export type PitchArsenal = {
  pitches: ArsenalPitch[]
}

const arsenalCache = new WeakMap<LivePlayer, PitchArsenal>()
const profileCache = new WeakMap<LivePlayer, BatterPitchProfile>()

export type BatterPitchProfile = {
  /** Multiplier applied to contact success against each family (~0.85-1.15). */
  contactMod: Record<PitchFamily, number>
  /** Multiplier applied to damage (extra-base tendency) per family. */
  powerMod: Record<PitchFamily, number>
  /** Tendency to swing at pitches outside the zone (~0.8-1.25). */
  chaseMod: number
}

function jitter(seedSource: string, spread: number): number {
  // Deterministic value in [-spread, +spread] derived from a seed string.
  return ((hashSeed(seedSource) % 1000) / 500 - 1) * spread
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * The hybrid seam: real arsenal mix if the snapshot carried one (quality
 * still derived from grades), fully synthesized otherwise. Callers never
 * need to know which they got.
 */
export function getArsenal(player: LivePlayer): PitchArsenal {
  const cached = arsenalCache.get(player)
  if (cached) return cached
  const built = buildArsenal(player)
  arsenalCache.set(player, built)
  return built
}

function buildArsenal(player: LivePlayer): PitchArsenal {
  const stuff = player.grades.stuff ?? 50
  const command = player.grades.command ?? 50

  if (player.arsenal && player.arsenal.pitches.length > 0) {
    const j = (family: string) => jitter(`${player.id}:q-${family}`, 8)
    const qualityFor = (family: PitchFamily): number =>
      clamp(
        j(family) +
          (family === 'fastball'
            ? stuff * 0.7 + command * 0.3
            : family === 'breaking'
              ? stuff * 0.85 + command * 0.15
              : stuff * 0.6 + command * 0.4),
        30,
        90,
      )
    return {
      pitches: player.arsenal.pitches.map((p) => ({
        family: p.family,
        usage: p.usage,
        quality: qualityFor(p.family),
      })),
    }
  }
  return synthesizePitchArsenal(player)
}

/**
 * Derives a pitcher's arsenal from his grades, role and handedness.
 *
 * Heuristics: power arms (high stuff, weaker command) lean on breaking
 * balls; command arms mix fastball/offspeed; relievers skew toward their
 * single best weapon. A stable id-hash varies pitchers within bands so
 * identical-stat pitchers still aren't clones.
 */
export function synthesizePitchArsenal(player: LivePlayer): PitchArsenal {
  const stuff = player.grades.stuff ?? 50
  const command = player.grades.command ?? 50
  const isReliever = !(player.pitcherRoles?.includes('SP') ?? false)
  const lefty = (player.pitchHand ?? 'R') === 'L'
  const j = (label: string) => jitter(`${player.id}:${label}`, 8)

  // Shape: how breaking-ball heavy vs fastball/offspeed heavy.
  const powerArm = clamp((stuff - command) / 40 + j('shape') / 80, -0.5, 0.5)
  let fastball = 0.42 - powerArm * 0.22 + j('fb') / 200
  let breaking = 0.3 + powerArm * 0.34 + (lefty ? 0.03 : 0) + j('brk') / 200
  let offspeed = 0.28 - powerArm * 0.12 - (lefty ? 0.03 : 0) + j('off') / 200

  // Relievers compress toward their best weapon (fewer pitches, harder ones).
  if (isReliever) {
    const best = Math.max(fastball, breaking, offspeed)
    const rest = fastball + breaking + offspeed - best
    fastball += (best - fastball) * 0.25
    breaking += (best - breaking) * 0.25
    offspeed += (best - offspeed) * 0.25
    void rest
  }

  const sum = fastball + breaking + offspeed
  const usage = { fastball: fastball / sum, breaking: breaking / sum, offspeed: offspeed / sum }

  const qualityFor = (family: PitchFamily, base: number): number =>
    clamp(base + j(`q-${family}`), 30, 90)

  const pitches = PITCH_FAMILIES.filter((f) => usage[f] > 0.08).map((family) => ({
    family,
    usage: usage[family],
    quality: qualityFor(
      family,
      family === 'fastball'
        ? stuff * 0.7 + command * 0.3
        : family === 'breaking'
          ? stuff * 0.85 + command * 0.15
          : stuff * 0.6 + command * 0.4,
    ),
  }))

  // Re-normalize after dropping tiny-usage families.
  const usedSum = pitches.reduce((s, p) => s + p.usage, 0)
  for (const p of pitches) p.usage /= usedSum

  return { pitches }
}

/** Picks a pitch family by weighted usage. No random draws — caller rolls. */
export function pickPitchFamily(
  arsenal: PitchArsenal,
  roll: number,
): PitchFamily {
  let acc = 0
  for (const pitch of arsenal.pitches) {
    acc += pitch.usage
    if (roll < acc) return pitch.family
  }
  return arsenal.pitches[arsenal.pitches.length - 1]?.family ?? 'fastball'
}

export function arsenalQualityFor(
  arsenal: PitchArsenal,
  family: PitchFamily,
): number {
  return arsenal.pitches.find((p) => p.family === family)?.quality ?? 50
}

/**
 * Derives how a batter handles each pitch family plus his chase tendency.
 * Archetypes: speed guys handle fastballs but dive over offspeed; pure
 * power sees breaking balls well but chases; high-contact batters cover
 * everything a little better.
 */
export function synthesizeBatterProfile(player: LivePlayer): BatterPitchProfile {
  const cached = profileCache.get(player)
  if (cached) return cached
  const profile = buildBatterProfile(player)
  profileCache.set(player, profile)
  return profile
}

function buildBatterProfile(player: LivePlayer): BatterPitchProfile {
  const contact = player.grades.contact ?? 50
  const power = player.grades.power ?? 50
  const speed = player.grades.speed ?? 50
  const leftyBat = (player.batSide ?? 'R') === 'L'
  // Fractional jitter: ±0.05 on a 1.0-centered multiplier.
  const j = (label: string) =>
    jitter(`${player.id}:bat-${leftyBat ? 'l' : 'r'}-${label}`, 10) / 200

  const base = 0.94 + (contact - 50) / 220 // ~0.94-1.06 band from contact
  const vsFastball = clamp(base + (speed - 50) / 300 + j('fb'), 0.82, 1.18)
  const vsBreaking = clamp(base - (power - 50) / 320 + j('brk'), 0.82, 1.18)
  const vsOffspeed = clamp(
    base - (speed - 50) / 340 - (power - 50) / 380 + j('off'),
    0.8,
    1.2,
  )

  return {
    contactMod: { fastball: vsFastball, breaking: vsBreaking, offspeed: vsOffspeed },
    powerMod: {
      fastball: clamp(1 + (power - 50) / 260 + j('pw-fb'), 0.85, 1.15),
      breaking: clamp(1 + (power - 50) / 300 + j('pw-brk'), 0.85, 1.15),
      offspeed: clamp(1 + (power - 50) / 240 + j('pw-off'), 0.85, 1.15),
    },
    chaseMod: clamp(
      1.06 - (contact - 50) / 160 + (power - 50) / 300 + j('chase') * 2,
      0.85,
      1.25,
    ),
  }
}
