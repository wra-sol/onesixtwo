import type { LivePlayer } from './live-types'

/**
 * The id-keyed view of a snapshot pool. One owner of the keying contract:
 * snapshot players are keyed by LivePlayer.id everywhere.
 */
export function indexPlayersById(
  players: readonly LivePlayer[],
): Map<string, LivePlayer> {
  return new Map(players.map((p) => [p.id, p]))
}
