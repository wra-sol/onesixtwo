import { PLAYER_BY_ID } from '../data'
import { BRAND } from './brand'
import {
  decodeShareLineup,
  encodeShareLineup,
  type ShareCodecError,
} from './share-codec'
import {
  getActiveLineupPositions,
  parseRosterFormatId,
  rosterFormatSlotCount,
} from './roster-format'
import type {
  Lineup,
  LineupPosition,
  RosterFormatId,
} from './types'

export type ParsedShare = {
  rosterFormatId: RosterFormatId
  playerIds: string[]
  reroll: number
}

export type ShareValidationError =
  | 'missing_players'
  | 'wrong_count'
  | 'invalid_reroll'
  | 'invalid_format'
  | 'unknown_player'
  | 'duplicate_person'
  | 'invalid_payload'

const SHARE_VALIDATION_MESSAGES: Record<ShareValidationError, string> = {
  missing_players: 'This share link is missing a lineup.',
  wrong_count: 'This share link has an invalid lineup format.',
  invalid_reroll: 'This share link has an invalid reroll value.',
  invalid_format: 'This share link has an invalid roster format.',
  unknown_player: 'This share link includes unknown players.',
  duplicate_person: 'This share link has duplicate players.',
  invalid_payload: 'This share link is invalid or outdated.',
}

/** User-facing copy for a failed share URL parse. */
export function shareValidationMessage(error: ShareValidationError): string {
  return SHARE_VALIDATION_MESSAGES[error]
}

const LEGACY_PLAYER_PARAM = 'p'
const COMPACT_PARAM = 'd'
const REROLL_PARAM = 'n'
const FORMAT_PARAM = 'f'
/** Bump when OG image format/layout changes to bust social CDN caches. */
const OG_IMAGE_VERSION = '5'

function lineupPlayerIds(
  lineup: Lineup,
  formatId: RosterFormatId,
): string[] {
  return getActiveLineupPositions(formatId).map((pos) => {
    const player = lineup[pos]
    if (!player) {
      throw new Error(`Lineup missing player at ${pos}`)
    }
    return player.id
  })
}

function parseReroll(value: string | null): number | null {
  if (value === null || value === '') return 0
  if (!/^\d+$/.test(value)) return null
  const reroll = Number.parseInt(value, 10)
  if (!Number.isFinite(reroll) || reroll < 0) return null
  return reroll
}

function codecErrorToValidation(error: ShareCodecError): ShareValidationError {
  switch (error) {
    case 'unknown_index':
      return 'unknown_player'
    case 'wrong_count':
      return 'wrong_count'
    case 'invalid_payload':
    default:
      return 'invalid_payload'
  }
}

function validateParsedPlayers(
  ids: string[],
  rosterFormatId: RosterFormatId,
  reroll: number,
): ParsedShare | ShareValidationError {
  if (ids.length !== rosterFormatSlotCount(rosterFormatId)) {
    return 'wrong_count'
  }

  const seenPersonIds = new Set<string>()
  for (const id of ids) {
    const player = PLAYER_BY_ID.get(id)
    if (!player) return 'unknown_player'
    if (seenPersonIds.has(player.personId)) return 'duplicate_person'
    seenPersonIds.add(player.personId)
  }

  return { rosterFormatId, playerIds: ids, reroll }
}

function buildShareSearchParams(
  playerIds: string[],
  rosterFormatId: RosterFormatId,
  reroll: number,
): URLSearchParams {
  const encoded = encodeShareLineup(playerIds, rosterFormatId)
  if (typeof encoded !== 'string') {
    throw new Error(`Could not encode share lineup: ${encoded}`)
  }

  const params = new URLSearchParams()
  params.set(COMPACT_PARAM, encoded)
  if (reroll > 0) {
    params.set(REROLL_PARAM, String(reroll))
  }
  return params
}

/** Build `/share?d=...&n=...` path + query (no origin). */
export function buildSharePath(
  lineup: Lineup,
  reroll = 0,
  formatId: RosterFormatId = 'classic',
): string {
  const ids = lineupPlayerIds(lineup, formatId)
  const params = buildShareSearchParams(ids, formatId, reroll)
  return `/share?${params.toString()}`
}

export function buildSharePathFromParsed(parsed: ParsedShare): string {
  const params = buildShareSearchParams(
    parsed.playerIds,
    parsed.rosterFormatId,
    parsed.reroll,
  )
  return `/share?${params.toString()}`
}

/** Absolute share URL for clipboard and native share. */
export function buildShareUrl(
  lineup: Lineup,
  reroll = 0,
  formatId: RosterFormatId = 'classic',
): string {
  return `${BRAND.url}${buildSharePath(lineup, reroll, formatId)}`
}

/** Build `/og?d=...&n=...` path + query for OG image endpoint. */
export function buildOgPath(parsed: ParsedShare): string {
  const params = buildShareSearchParams(
    parsed.playerIds,
    parsed.rosterFormatId,
    parsed.reroll,
  )
  params.set('v', OG_IMAGE_VERSION)
  return `/og?${params.toString()}`
}

export function buildOgUrl(parsed: ParsedShare): string {
  return `${BRAND.url}${buildOgPath(parsed)}`
}

export function parseShareParams(
  searchParams: URLSearchParams,
): ParsedShare | ShareValidationError {
  const reroll = parseReroll(searchParams.get(REROLL_PARAM))
  if (reroll === null) return 'invalid_reroll'

  const compact = searchParams.get(COMPACT_PARAM)
  if (compact?.trim()) {
    const decoded = decodeShareLineup(compact)
    if (typeof decoded === 'string') {
      return codecErrorToValidation(decoded)
    }
    return validateParsedPlayers(
      decoded.playerIds,
      decoded.rosterFormatId,
      reroll,
    )
  }

  const raw = searchParams.get(LEGACY_PLAYER_PARAM)
  if (!raw?.trim()) return 'missing_players'

  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean)
  const formatRaw = searchParams.get(FORMAT_PARAM)
  const rosterFormatId = formatRaw
    ? parseRosterFormatId(formatRaw)
    : 'classic'
  if (!rosterFormatId) return 'invalid_format'

  return validateParsedPlayers(ids, rosterFormatId, reroll)
}

export function reconstructLineup(parsed: ParsedShare): Lineup | null {
  const lineup = {} as Lineup
  const positions = getActiveLineupPositions(parsed.rosterFormatId)
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i] as LineupPosition
    const player = PLAYER_BY_ID.get(parsed.playerIds[i]!)
    if (!player) return null
    lineup[pos] = player
  }
  return lineup
}

export function isParsedShare(
  value: ParsedShare | ShareValidationError,
): value is ParsedShare {
  return typeof value === 'object' && value !== null && 'playerIds' in value
}

/** @deprecated Legacy comma-separated player IDs; prefer compact `d=` URLs. */
export function buildLegacySharePath(
  lineup: Lineup,
  reroll = 0,
  formatId: RosterFormatId = 'classic',
): string {
  const ids = lineupPlayerIds(lineup, formatId)
  const params = new URLSearchParams()
  params.set(LEGACY_PLAYER_PARAM, ids.join(','))
  if (formatId !== 'classic') {
    params.set(FORMAT_PARAM, formatId)
  }
  if (reroll > 0) {
    params.set(REROLL_PARAM, String(reroll))
  }
  return `/share?${params.toString()}`
}
