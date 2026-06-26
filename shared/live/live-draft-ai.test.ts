import { describe, expect, it } from 'vitest'
import { createEmptyDailyLineup } from './daily-roster'
import { buildFixtureLiveDraftSnapshot } from './live-fixtures'
import { hasDistinctPickPair } from './live-draft'
import {
  pickAiPlayerFromPool,
  scorePlayerForAi,
  shouldAiAttemptReroll,
} from './live-draft-ai'

describe('hasDistinctPickPair', () => {
  it('returns false when only one player can fill both lineups', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    const team = snapshot.players.filter((player) => player.teamId === 119)
    const catchers = team.filter((player) => player.positions.includes('C'))
    const lineup = createEmptyDailyLineup()

    expect(catchers.length).toBeGreaterThanOrEqual(1)
    expect(hasDistinctPickPair([catchers[0]!], lineup, lineup)).toBe(false)
  })

  it('returns true when two catchers can fill the same open slot', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    const team = snapshot.players.filter((player) => player.teamId === 119)
    const catchers = team.filter((player) => player.positions.includes('C'))
    const lineup = createEmptyDailyLineup()

    expect(catchers.length).toBeGreaterThanOrEqual(2)
    expect(hasDistinctPickPair(catchers.slice(0, 2), lineup, lineup)).toBe(true)
  })
})

describe('live-draft-ai', () => {
  it('skips reroll when the pool is strong enough', () => {
    expect(shouldAiAttemptReroll(70, 'seed', 3)).toBe(false)
  })

  it('scores catchers higher in late rounds when C is still open', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    const catcher = snapshot.players.find(
      (player) => player.teamId === 119 && player.positions.includes('C'),
    )!
    const hitter = snapshot.players.find(
      (player) =>
        player.teamId === 119 &&
        player.role === 'hitter' &&
        !player.positions.includes('C'),
    )!

    const lineup = createEmptyDailyLineup()
    const lateContext = { round: 10, userPickThisRound: false }
    const earlyContext = { round: 2, userPickThisRound: false }

    expect(scorePlayerForAi(catcher, lineup, lateContext)).toBeGreaterThan(
      scorePlayerForAi(hitter, lineup, lateContext),
    )
    expect(scorePlayerForAi(catcher, lineup, earlyContext)).toBeGreaterThanOrEqual(
      scorePlayerForAi(hitter, lineup, earlyContext),
    )
  })

  it('picks from the available round pool', () => {
    const snapshot = buildFixtureLiveDraftSnapshot('2026-06-25')
    const team = snapshot.players.filter((player) => player.teamId === 119)
    const pick = pickAiPlayerFromPool(
      team,
      createEmptyDailyLineup(),
      { round: 1, userPickThisRound: false },
      'seed',
      1,
    )
    expect(pick).not.toBeNull()
    expect(team.some((player) => player.id === pick!.id)).toBe(true)
  })
})
