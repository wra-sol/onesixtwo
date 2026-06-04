import bucketsJson from './generated/buckets.json'
import playersJson from './generated/players.json'
import { playerCoversLineupPosition } from '../lib/player-eligibility'
import { BASE_LINEUP_POSITIONS } from '../lib/roster-format'
import { decodeUnicodeEscapes } from '../lib/text'
import type { DraftBucket, Player } from '../lib/types'

function normalizePlayerNames(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    name: decodeUnicodeEscapes(player.name),
  }))
}

export const PLAYERS: Player[] = normalizePlayerNames(playersJson as Player[])
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
    const personIds = players.map((p) => p.personId)
    const uniquePersonIds = new Set(personIds)
    if (personIds.length !== uniquePersonIds.size) {
      errors.push(`Bucket ${bucket.id} has duplicate personId entries`)
    }
    const names = players.map((p) => p.name)
    const uniqueNames = new Set(names)
    if (names.length !== uniqueNames.size) {
      errors.push(`Bucket ${bucket.id} has duplicate player names`)
    }
    for (const position of BASE_LINEUP_POSITIONS) {
      if (!players.some((player) => playerCoversLineupPosition(player, position))) {
        errors.push(`Bucket ${bucket.id} missing position coverage: ${position}`)
      }
    }
  }
  return errors
}
