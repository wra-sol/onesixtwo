import { describe, expect, it } from 'vitest'
import { buildLegendsSnapshotForSim162 } from '../../src/lib/classic-live-adapter'
import {
  createSim162DraftState,
  autoFillRemaining,
} from '../../shared/live/sim162-draft'
import {
  roster25BattingOrder,
  roster25Rotation,
  roster25ToPlayerIds,
} from '../../shared/live/roster25'
import { heuristicAiBattingOrder } from '../../shared/live/live-draft'
import { verifySim162Submission } from './sim162-verify'

function draftAndVerify() {
  const snapshot = buildLegendsSnapshotForSim162()
  let state = createSim162DraftState(snapshot.players)
  state = autoFillRemaining(state)
  const roster = state.roster
  const battingOrder = heuristicAiBattingOrder(roster25BattingOrder(roster))
  const rotationOrder = roster25Rotation(roster)

  return verifySim162Submission(
    {
      pool: 'legends',
      challengeDate: '2026-06-25',
      playerIds: roster25ToPlayerIds(roster),
      battingOrderIds: battingOrder.map((p) => p.id),
      rotationOrderIds: rotationOrder.map((p) => p.id),
    },
    {},
  )
}

describe('verifySim162Submission', () => {
  it('re-sims the season and derives a plausible record', async () => {
    const verified = await draftAndVerify()
    expect(verified.ok).toBe(true)
    if (!verified.ok) return
    expect(verified.wins).toBeGreaterThanOrEqual(0)
    expect(verified.wins).toBeLessThanOrEqual(162)
    expect(verified.wins + verified.losses).toBe(162)
    expect(verified.postseasonRank).toBeGreaterThanOrEqual(1)
    expect(verified.seasonSeed).toContain('::')
  }, 30_000)

  it('is deterministic for the same submitted ids', async () => {
    const [a, b] = [await draftAndVerify(), await draftAndVerify()]
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect({
      wins: a.wins,
      losses: a.losses,
      postseasonResult: a.postseasonResult,
      seasonSeed: a.seasonSeed,
    }).toEqual({
      wins: b.wins,
      losses: b.losses,
      postseasonResult: b.postseasonResult,
      seasonSeed: b.seasonSeed,
    })
  }, 60_000)

  it('rejects rosters referencing players outside the pool', async () => {
    const snapshot = buildLegendsSnapshotForSim162()
    let state = createSim162DraftState(snapshot.players)
    state = autoFillRemaining(state)

    const verified = await verifySim162Submission(
      {
        pool: 'legends',
        challengeDate: '2026-06-25',
        playerIds: ['definitely-not-a-real-player-id', ...roster25ToPlayerIds(state.roster).slice(1)],
        battingOrderIds: roster25BattingOrder(state.roster).map((p) => p.id),
        rotationOrderIds: roster25Rotation(state.roster).map((p) => p.id),
      },
      {},
    )
    expect(verified.ok).toBe(false)
    if (verified.ok) return
    expect(verified.error).toMatch(/outside the pool/)
  }, 30_000)
})
