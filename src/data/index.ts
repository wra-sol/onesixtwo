import bucketsJson from './generated/buckets.json'
import playersJson from './generated/players.json'
import type { DraftBucket, Player } from '../lib/types'

export const PLAYERS: Player[] = playersJson as Player[]
export const DRAFT_BUCKETS: DraftBucket[] = bucketsJson as DraftBucket[]

export const PLAYER_BY_ID = new Map(PLAYERS.map((player) => [player.id, player]))

export const MIN_BUCKET_PLAYERS = 2

export function getPlayersForBucket(bucket: DraftBucket): Player[] {
  return bucket.playerIds
    .map((id) => PLAYER_BY_ID.get(id))
    .filter((player): player is Player => player !== undefined)
}

export function validateDataset(): string[] {
  const errors: string[] = []
  for (const bucket of DRAFT_BUCKETS) {
    const players = getPlayersForBucket(bucket)
    if (players.length < MIN_BUCKET_PLAYERS) {
      errors.push(`Bucket ${bucket.id} has only ${players.length} players`)
    }
  }
  const allPositions = new Set(PLAYERS.flatMap((p) => p.positions))
  for (const pos of ['C', 'SS', 'CF', 'P'] as const) {
    if (!allPositions.has(pos)) {
      errors.push(`Dataset missing position coverage: ${pos}`)
    }
  }
  return errors
}
