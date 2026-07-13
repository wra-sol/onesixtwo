import { continuousToDisplayGrade } from './live-grades'
import {
  dailyLineupOpenPositions,
  dailyLineupPlayers,
  playerEligibleForDailyPosition,
  type DailyLineupPosition,
} from './daily-roster'
import { bestOpenPosition } from './live-draft-positions'
import type { DailyMatchupDraftState, LivePlayer } from './live-types'

/** Total star budget for a Daily Matchup roster (12 slots, min cost 1 each => 8 "upgrade" points). */
export const DAILY_STAR_BUDGET = 20

/** Star cost of a player by displayed overall grade: 80->4, 70->3, 60->2, <=50->1. */
export function playerStarCost(player: LivePlayer): number {
  const display = continuousToDisplayGrade(player.grades.overall)
  return Math.max(1, Math.min(4, (display - 40) / 10))
}

/** Stars already committed in the current lineup. */
export function dailyMatchupStarSpent(state: DailyMatchupDraftState): number {
  return dailyLineupPlayers(state.lineup).reduce((sum, p) => sum + playerStarCost(p), 0)
}

export type DailyStarBudgetInfo = { spent: number; budget: number; remaining: number }

export function dailyMatchupStarBudget(state: DailyMatchupDraftState): DailyStarBudgetInfo {
  const spent = dailyMatchupStarSpent(state)
  return { spent, budget: DAILY_STAR_BUDGET, remaining: DAILY_STAR_BUDGET - spent }
}

/**
 * Cheapest star cost among pool players that could still legally fill `position`
 * (eligible, not drafted, team not already used, not the opponent's team).
 * Returns 0 if no such player exists (that slot can't be filled anyway).
 */
export function minEligibleStarCostForPosition(
  position: DailyLineupPosition,
  state: DailyMatchupDraftState,
  pool: LivePlayer[],
): number {
  let min = Infinity
  for (const p of pool) {
    if (state.draftedPlayerIds.includes(p.id)) continue
    if (state.draftedTeamIds.includes(p.teamId)) continue
    if (p.teamId === state.opponent.teamId) continue
    if (!playerEligibleForDailyPosition(p, position)) continue
    const c = playerStarCost(p)
    if (c < min) min = c
  }
  return min === Infinity ? 0 : min
}

/**
 * True if drafting `player` keeps the roster completable within budget.
 * ENFORCEMENT IS OPT-IN AND POOL-GATED: the star budget only applies when the
 * user has enabled Salary Cap mode (`state.salaryCapEnabled`) AND a pool is
 * supplied; otherwise this returns true (draft freely). This preserves the
 * default free-draft experience and existing callers/tests.
 * Reserve = sum of the cheapest eligible cost for every OTHER still-open slot,
 * guaranteeing the remaining roster can always be finished within budget (no soft-lock).
 */
export function canAffordDailyPick(
  state: DailyMatchupDraftState,
  player: LivePlayer,
  pool: LivePlayer[],
): boolean {
  if (!state.salaryCapEnabled) return true
  if (pool.length === 0) return true
  const fillPos = bestOpenPosition(player, state.lineup)
  if (fillPos === null) return true // no slot; other checks handle this
  const cost = playerStarCost(player)
  const spent = dailyMatchupStarSpent(state)
  let reserve = 0
  for (const pos of dailyLineupOpenPositions(state.lineup)) {
    if (pos === fillPos) continue
    reserve += minEligibleStarCostForPosition(pos, state, pool)
  }
  return spent + cost + reserve <= DAILY_STAR_BUDGET
}
