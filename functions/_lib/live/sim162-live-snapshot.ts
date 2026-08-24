import type { Sim162Snapshot } from '../../../shared/live/sim162-snapshot'
import { buildLiveDraftSnapshot } from './live-draft-snapshot'
import type { MlbDataSource } from './mlb-source'
import { sim162LiveSnapshotSeed } from '../../../shared/live/seeds'

export async function buildSim162LiveSnapshot(
  challengeDate: string,
  source: MlbDataSource,
): Promise<Sim162Snapshot> {
  const draft = await buildLiveDraftSnapshot(challengeDate, source)
  return {
    kind: 'sim162-live',
    players: draft.players,
    simSeed: sim162LiveSnapshotSeed(challengeDate),
  }
}
