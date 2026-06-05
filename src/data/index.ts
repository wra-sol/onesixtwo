import { getModeDataset, validateModeDataset } from './modes'

const allTime = getModeDataset('all-time')

/** @deprecated Prefer getModeDataset('all-time') */
export const PLAYERS = allTime.players
/** @deprecated Prefer getModeDataset('all-time') */
export const DRAFT_BUCKETS = allTime.draftBuckets
/** @deprecated Prefer getModeDataset('all-time') */
export const PLAYER_BY_ID = allTime.playerById
/** @deprecated Prefer getModeDataset('all-time') */
export const MIN_BUCKET_PLAYERS = allTime.minBucketPlayers
/** @deprecated Prefer getModeDataset('all-time') */
export const getPlayersForBucket = allTime.getPlayersForBucket

export { getModeDataset, validateModeDataset } from './modes'

export function validateDataset(): string[] {
  return validateModeDataset('all-time')
}
