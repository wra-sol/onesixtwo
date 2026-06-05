import activeBucketsJson from './generated/active/buckets.json'
import activePlayersJson from './generated/active/players.json'
import allTimeBucketsJson from './generated/buckets.json'
import allTimePlayersJson from './generated/players.json'
import { playerCoversLineupPosition } from '../lib/player-eligibility'
import { BASE_LINEUP_POSITIONS } from '../lib/roster-format'
import { decodeUnicodeEscapes } from '../lib/text'
import type { DraftBucket, GameModeId, Player } from '../lib/types'

export type ModeDataset = {
  players: Player[]
  draftBuckets: DraftBucket[]
  playerById: Map<string, Player>
  minBucketPlayers: number
  getPlayersForBucket: (bucket: DraftBucket) => Player[]
}

function normalizePlayerNames(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    name: decodeUnicodeEscapes(player.name),
  }))
}

function buildDataset(
  playersJson: Player[],
  bucketsJson: DraftBucket[],
): ModeDataset {
  const players = normalizePlayerNames(playersJson)
  const draftBuckets = bucketsJson
  const playerById = new Map(players.map((player) => [player.id, player]))

  return {
    players,
    draftBuckets,
    playerById,
    minBucketPlayers: 2,
    getPlayersForBucket(bucket: DraftBucket): Player[] {
      return bucket.playerIds
        .map((id) => playerById.get(id))
        .filter((player): player is Player => player !== undefined)
    },
  }
}

const ALL_TIME_DATASET = buildDataset(
  allTimePlayersJson as Player[],
  allTimeBucketsJson as DraftBucket[],
)

const ACTIVE_DATASET = buildDataset(
  activePlayersJson as Player[],
  activeBucketsJson as DraftBucket[],
)

const MODE_DATASETS: Record<GameModeId, ModeDataset> = {
  'all-time': ALL_TIME_DATASET,
  active: ACTIVE_DATASET,
}

export function getModeDataset(modeId: GameModeId = 'all-time'): ModeDataset {
  return MODE_DATASETS[modeId]
}

export function parseGameModeId(raw: string | null | undefined): GameModeId | null {
  if (raw === 'all-time' || raw === 'active') return raw
  return null
}

export const DEFAULT_GAME_MODE_ID: GameModeId = 'all-time'

export function validateModeDataset(modeId: GameModeId): string[] {
  const dataset = getModeDataset(modeId)
  const errors: string[] = []
  for (const bucket of dataset.draftBuckets) {
    const players = dataset.getPlayersForBucket(bucket)
    if (players.length < dataset.minBucketPlayers) {
      errors.push(`[${modeId}] Bucket ${bucket.id} has only ${players.length} players`)
    }
    const personIds = players.map((p) => p.personId)
    const uniquePersonIds = new Set(personIds)
    if (personIds.length !== uniquePersonIds.size) {
      errors.push(`[${modeId}] Bucket ${bucket.id} has duplicate personId entries`)
    }
    const names = players.map((p) => p.name)
    const uniqueNames = new Set(names)
    if (names.length !== uniqueNames.size) {
      errors.push(`[${modeId}] Bucket ${bucket.id} has duplicate player names`)
    }
    for (const position of BASE_LINEUP_POSITIONS) {
      if (!players.some((player) => playerCoversLineupPosition(player, position))) {
        errors.push(`[${modeId}] Bucket ${bucket.id} missing position coverage: ${position}`)
      }
    }
  }
  return errors
}
