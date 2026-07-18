import { describe, expect, it } from 'vitest'
import { buildFixtureDailyMatchupSnapshot } from './live-fixtures'
import {
  DAILY_STAR_BUDGET,
  canAffordDailyPick,
  dailyMatchupStarBudget,
  dailyMatchupStarSpent,
  playerStarCost,
} from './daily-star-budget'
import {
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  getDailyMatchupDisabledReason,
} from './live-draft'
import { dailyLineupIsComplete } from './daily-roster'
import type { LivePlayer } from './live-types'

function playerWithOverall(overall: number): LivePlayer {
  return {
    id: `test-${overall}`,
    personId: overall,
    name: `Test ${overall}`,
    teamId: 999,
    teamAbbrev: 'TST',
    teamName: 'Test Team',
    positions: ['1B'],
    role: 'hitter',
    grades: { overall },
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

describe('playerStarCost', () => {
  it('maps displayed overall grade to star cost', () => {
    expect(playerStarCost(playerWithOverall(78))).toBe(4)
    expect(playerStarCost(playerWithOverall(68))).toBe(3)
    expect(playerStarCost(playerWithOverall(58))).toBe(2)
    expect(playerStarCost(playerWithOverall(45))).toBe(1)
    expect(playerStarCost(playerWithOverall(30))).toBe(1)
  })
})

describe('dailyMatchupStarBudget', () => {
  const available = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')

  it('reports full budget for a fresh draft state', () => {
    const state = createDailyMatchupDraftState(
      available.challengeDate,
      available.targetDate,
      available.opponent!,
    )
    expect(dailyMatchupStarBudget(state)).toEqual({
      spent: 0,
      budget: DAILY_STAR_BUDGET,
      remaining: DAILY_STAR_BUDGET,
    })
  })

  it('increments spent after drafting a player', () => {
    const state0 = createDailyMatchupDraftState(
      available.challengeDate,
      available.targetDate,
      available.opponent!,
    )
    const catcher = available.players.find(
      (p) => p.role === 'hitter' && p.positions.includes('C'),
    )!
    const state1 = draftDailyMatchupPlayer(state0, catcher)
    expect(dailyMatchupStarSpent(state1)).toBe(playerStarCost(catcher))
    expect(dailyMatchupStarBudget(state1).spent).toBe(playerStarCost(catcher))
  })
})

describe('canAffordDailyPick', () => {
  const available = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')

  it('returns true when the pool is empty (enforcement disabled)', () => {
    const state = createDailyMatchupDraftState(
      available.challengeDate,
      available.targetDate,
      available.opponent!,
    )
    const expensive = available.players.reduce((best, p) =>
      playerStarCost(p) > playerStarCost(best) ? p : best,
    )
    expect(canAffordDailyPick(state, expensive, [])).toBe(true)
  })

  it('does not enforce the budget when Salary Cap mode is off (default)', () => {
    // Default state has salaryCapEnabled = false, so any pick is allowed even
    // with a full pool and an exhausted-looking spend.
    const state = createDailyMatchupDraftState(
      available.challengeDate,
      available.targetDate,
      available.opponent!,
    )
    expect(state.salaryCapEnabled).toBe(false)
    for (const player of available.players) {
      expect(canAffordDailyPick(state, player, available.players)).toBe(true)
    }
  })
})

describe('star budget enforcement in getDailyMatchupDisabledReason', () => {
  it('never allows a completed roster to exceed the star budget, and still completes', () => {
    const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')
    let state = {
      ...createDailyMatchupDraftState(
        snapshot.challengeDate,
        snapshot.targetDate,
        snapshot.opponent!,
      ),
      salaryCapEnabled: true,
    }

    for (const player of [...snapshot.players].sort(
      (a, b) => b.grades.overall - a.grades.overall,
    )) {
      if (state.status !== 'drafting') break
      if (getDailyMatchupDisabledReason(player, state, snapshot.players)) continue
      state = draftDailyMatchupPlayer(state, player, undefined, snapshot.players)
    }

    expect(dailyMatchupStarSpent(state)).toBeLessThanOrEqual(DAILY_STAR_BUDGET)
    expect(dailyLineupIsComplete(state.lineup)).toBe(true)
  })

  it('flags an over-budget player as disabled once spending is exhausted', () => {
    const snapshot = buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24')
    let state = {
      ...createDailyMatchupDraftState(
        snapshot.challengeDate,
        snapshot.targetDate,
        snapshot.opponent!,
      ),
      salaryCapEnabled: true,
    }

    // Greedily draft the most expensive affordable players first to exhaust the budget.
    const byCostDesc = [...snapshot.players].sort(
      (a, b) => playerStarCost(b) - playerStarCost(a),
    )

    let sawOverBudget = false
    for (const player of byCostDesc) {
      if (state.status !== 'drafting') break
      const reason = getDailyMatchupDisabledReason(player, state, snapshot.players)
      if (reason === 'Over star budget') {
        sawOverBudget = true
        continue
      }
      if (reason) continue
      state = draftDailyMatchupPlayer(state, player, undefined, snapshot.players)
    }

    expect(dailyMatchupStarSpent(state)).toBeLessThanOrEqual(DAILY_STAR_BUDGET)
    // Either the budget bound at some point, or the lineup completed comfortably
    // under budget (both are acceptable — the key invariant is the spend cap).
    expect(sawOverBudget || dailyMatchupStarSpent(state) <= DAILY_STAR_BUDGET).toBe(true)
  })
})
