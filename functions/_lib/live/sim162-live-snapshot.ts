import type { Sim162Snapshot } from '../../../shared/live/sim162-snapshot'
import { buildLiveDraftSnapshot } from './live-draft-snapshot'

export async function buildSim162LiveSnapshot(
  challengeDate: string,
): Promise<Sim162Snapshot> {
  const draft = await buildLiveDraftSnapshot(challengeDate)
  return {
    kind: 'sim162-live',
    players: draft.players,
    simSeed: `${challengeDate}|sim162-live`,
  }
}
