import type { LivePlayer } from './live-types'
import type { PitcherCondition } from './count-engine'
import { gradeNorm } from './pa-outcomes'

/**
 * Per-team pitching staff state across a season: who pitched, how hard,
 * and how long ago. This is what makes rotation depth and bullpen
 * construction strategically real — a reliever who threw 40 pitches
 * yesterday is worse today, and arms decay within an outing as pitch
 * counts climb past what their stamina supports.
 */
export type TeamStaffState = {
  /** Games of rest since this pitcher's last appearance. Absent = fresh. */
  rest: Record<string, number>
  /** Pitch counts from each pitcher's most recent outing. */
  lastOutingPitches: Record<string, number>
}

export function createStaffState(): TeamStaffState {
  return { rest: {}, lastOutingPitches: {} }
}

/** Advances every pitcher's rest counter by one team-game. Call after each game. */
export function advanceRest(staff: TeamStaffState): void {
  for (const id of Object.keys(staff.rest)) {
    staff.rest[id]! += 1
  }
}

/** Records that a pitcher appeared and threw this many pitches. */
export function recordAppearance(
  staff: TeamStaffState,
  playerId: string,
  pitches: number,
): void {
  staff.rest[playerId] = 0
  staff.lastOutingPitches[playerId] = pitches
}

/**
 * Effective stuff/command multipliers for a pitcher taking the mound:
 * within-outing fatigue from his running pitch count versus his stamina
 * grade, plus across-game wear for relievers working on zero days' rest.
 */
export function conditionFor(
  player: LivePlayer,
  options: {
    staff?: TeamStaffState
    /** Pitches already thrown by this pitcher in the current game. */
    currentGamePitches?: number
  } = {},
): PitcherCondition {
  const stamina = gradeNorm(player.grades.stamina)
  let stuffMult = 1
  let commandMult = 1

  // Within-outing fatigue: capacity scales with stamina (~100 pitches at 50).
  const current = options.currentGamePitches
  if (current !== undefined) {
    const capacity = 60 + stamina * 80 // 40 @ stamina .5 -> ~100 pitches at 50 grade? kept generous
    const softCap = capacity * 0.7
    if (current > softCap) {
      const over = (current - softCap) / Math.max(20, capacity * 0.45)
      const decay = clamp01(over * (1.7 - stamina))
      stuffMult -= decay * 0.22
      commandMult -= decay * 0.28
    }
  }

  // Across-game wear: relievers on back-to-back after heavy work.
  const staff = options.staff
  if (staff && (staff.rest[player.id] ?? 99) <= 1) {
    const recent = staff.lastOutingPitches[player.id] ?? 0
    const wear = clamp01((recent - 15) / 40)
    stuffMult -= wear * 0.08
    commandMult -= wear * 0.1
  }

  return {
    stuffMult: Math.max(0.55, stuffMult),
    commandMult: Math.max(0.5, commandMult),
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
