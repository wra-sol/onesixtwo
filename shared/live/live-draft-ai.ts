import { createSeededRandomFromString } from './rng'
import { dailyLineupOpenPositions } from './daily-roster'
import type { DailyLineup, DailyLineupPosition } from './daily-roster'
import { bestOpenPosition } from './live-draft-positions'
import type { LivePlayer } from './live-types'

export const AI_REROLL_SCORE_THRESHOLD = 62
/** When the round pool is weak, AI attempts its one re-spin with this probability. */
export const AI_REROLL_ATTEMPT_CHANCE = 0.4
export const AI_BLOCK_CHANCE_AFTER_USER = 0.28
export const AI_BLOCK_CHANCE_FIRST = 0.12
export const AI_STRONG_PLAYER_OVERALL = 72
export const AI_TOP_CANDIDATES = 3
export const AI_PICK_ROLL_TOP = 0.55
export const AI_PICK_ROLL_SECOND = 0.85

const POSITION_BONUS: Partial<Record<DailyLineupPosition, number>> = {
  SP: 8,
  CL: 8,
  RP: 4,
  C: 6,
  SS: 3,
}

const LATE_ROUND_BONUS: Array<{
  minRound: number
  position: DailyLineupPosition
  bonus: number
}> = [
  { minRound: 9, position: 'C', bonus: 12 },
  { minRound: 10, position: 'CL', bonus: 10 },
  { minRound: 10, position: 'SP', bonus: 8 },
]

export type AiPickContext = {
  round: number
  userPickThisRound: boolean
}

export function scorePlayerForAi(
  player: LivePlayer,
  lineup: DailyLineup,
  context: AiPickContext,
): number {
  const position = bestOpenPosition(player, lineup)
  if (!position) return -1

  let score = player.grades.overall
  score += POSITION_BONUS[position] ?? 0

  const open = dailyLineupOpenPositions(lineup)
  for (const rule of LATE_ROUND_BONUS) {
    if (context.round >= rule.minRound && open.includes(rule.position) && position === rule.position) {
      score += rule.bonus
    }
  }

  if (context.userPickThisRound && player.grades.overall >= AI_STRONG_PLAYER_OVERALL) {
    score += 4
  }

  return score
}

export function pickAiPlayerFromPool(
  available: LivePlayer[],
  lineup: DailyLineup,
  context: AiPickContext,
  simSeed: string,
  currentPick: number,
): LivePlayer | null {
  if (available.length === 0) return null

  const random = createSeededRandomFromString(`${simSeed}|pick${currentPick}`)
  const scored = available
    .map((player) => ({
      player,
      score: scorePlayerForAi(player, lineup, context),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null

  const top = scored.slice(0, Math.min(AI_TOP_CANDIDATES, scored.length))
  const blockChance = context.userPickThisRound
    ? AI_BLOCK_CHANCE_AFTER_USER
    : AI_BLOCK_CHANCE_FIRST
  if (random() < blockChance && top.length > 1) {
    return top[0]!.player
  }

  const roll = random()
  const index =
    roll < AI_PICK_ROLL_TOP
      ? 0
      : roll < AI_PICK_ROLL_SECOND
        ? Math.min(1, top.length - 1)
        : Math.min(2, top.length - 1)
  return top[index]!.player
}

export function shouldAiAttemptReroll(
  bestScore: number,
  simSeed: string,
  round: number,
): boolean {
  if (bestScore >= AI_REROLL_SCORE_THRESHOLD) {
    return false
  }
  const random = createSeededRandomFromString(`${simSeed}|ai-reroll|round${round}`)
  return random() <= AI_REROLL_ATTEMPT_CHANCE
}
