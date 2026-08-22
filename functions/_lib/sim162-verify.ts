import { buildLegendsSnapshotForSim162 } from '../../src/lib/classic-live-adapter'
import { resolveSim162LiveSnapshot } from './live/resolve-snapshot'
import {
  roster25FromPlayerIds,
  roster25IsComplete,
} from '../../shared/live/roster25'
import { sim162SeasonSeed } from '../../shared/live/seeds'
import { buildSim162Season, type PostseasonResult } from '../../shared/live/sim162-season'
import { POSTSEASON_RANK, type Sim162Pool } from './sim162-leaderboard'

export type Sim162VerifyInput = {
  pool: Sim162Pool
  challengeDate: string
  playerIds: readonly string[]
  battingOrderIds: readonly string[]
  rotationOrderIds: readonly string[]
}

export type VerifiedSim162Result = {
  ok: true
  wins: number
  losses: number
  postseasonResult: PostseasonResult
  wonWorldSeries: boolean
  userQualified: boolean
  postseasonRank: number
  /** Season seed used for the re-sim (derived server-side from the pool). */
  seasonSeed: string
}

export type Sim162VerifyEnv = {
  DB?: D1Database
  USE_LIVE_FIXTURES?: string
}

/**
 * Rebuilds the submitted Sim 162 season on the server and derives every
 * stored value from the deterministic re-sim. Claimed numbers from the
 * client are never trusted: given the same pool, roster ids, orders, and
 * seed, buildSim162Season always produces the identical season, so the
 * server-side replay IS the result.
 */
export async function verifySim162Submission(
  input: Sim162VerifyInput,
  env: Sim162VerifyEnv,
): Promise<VerifiedSim162Result | { ok: false; error: string }> {
  const snapshot =
    input.pool === 'live'
      ? await resolveSim162LiveSnapshot(input.challengeDate, env)
      : buildLegendsSnapshotForSim162()

  const playersById = new Map(snapshot.players.map((p) => [p.id, p]))

  const roster = roster25FromPlayerIds(input.playerIds, playersById)
  if (!roster25IsComplete(roster)) {
    return { ok: false, error: 'Roster includes players outside the pool.' }
  }

  const battingOrder = input.battingOrderIds
    .map((id) => playersById.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const rotationOrder = input.rotationOrderIds
    .map((id) => playersById.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  if (battingOrder.length !== 9 || rotationOrder.length !== 5) {
    return { ok: false, error: 'Orders include players outside the pool.' }
  }

  // The season seed is derived from the SERVER's pool seed, not any
  // client-provided value, so tampering with the seed cannot change outcomes.
  const seasonSeed = sim162SeasonSeed(roster, snapshot.simSeed)

  const result = buildSim162Season(
    roster,
    battingOrder,
    rotationOrder,
    snapshot,
    seasonSeed,
  )

  return {
    ok: true,
    wins: result.userRecord.wins,
    losses: result.userRecord.losses,
    postseasonResult: result.postseasonResult,
    wonWorldSeries: result.wonWorldSeries,
    userQualified: result.userQualified,
    postseasonRank: POSTSEASON_RANK[result.postseasonResult],
    seasonSeed,
  }
}
