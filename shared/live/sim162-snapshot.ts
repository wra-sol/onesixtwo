import type { LivePlayer } from './live-types'

export type Sim162PoolKind = 'sim162-legends' | 'sim162-live'

export type Sim162Snapshot = {
  kind: Sim162PoolKind
  players: LivePlayer[]
  simSeed: string
}

export function filterSim162PlayersByTeam(
  players: LivePlayer[],
  teamId: number,
): LivePlayer[] {
  return players.filter((player) => player.teamId === teamId)
}
