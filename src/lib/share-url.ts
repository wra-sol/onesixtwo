import { PLAYER_BY_ID } from '../data'
import { BRAND } from './brand'
import {
  getActiveLineupPositions,
  parseRosterFormatId,
  rosterFormatSlotCount,
} from './roster-format'
import type {
  Lineup,
  LineupPosition,
  Player,
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

const SHARE_VALIDATION_MESSAGES: Record<ShareValidationError, string> = {
  missing_players: 'This share link is missing a lineup.',
  wrong_count: 'This share link has an invalid lineup format.',
  invalid_reroll: 'This share link has an invalid reroll value.',
  invalid_format: 'This share link has an invalid roster format.',
  unknown_player: 'This share link includes unknown players.',
  duplicate_person: 'This share link has duplicate players.',
}

/** User-facing copy for a failed share URL parse. */
export function shareValidationMessage(error: ShareValidationError): string {
  return SHARE_VALIDATION_MESSAGES[error]
}

const PLAYER_PARAM = 'p'
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

/** Build `/share?p=...&n=...&f=...` path + query (no origin). */
export function buildSharePath(
  lineup: Lineup,
  reroll = 0,
  formatId: RosterFormatId = 'classic',
): string {
  const ids = lineupPlayerIds(lineup, formatId)
  const params = new URLSearchParams()
  params.set(PLAYER_PARAM, ids.join(','))
  if (formatId !== 'classic') {
    params.set(FORMAT_PARAM, formatId)
  }
  if (reroll > 0) {
    params.set(REROLL_PARAM, String(reroll))
  }
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

/** Build `/og?p=...&n=...` path + query for OG image endpoint. */
export function buildOgPath(parsed: ParsedShare): string {
  const params = new URLSearchParams()
  params.set(PLAYER_PARAM, parsed.playerIds.join(','))
  if (parsed.rosterFormatId !== 'classic') {
    params.set(FORMAT_PARAM, parsed.rosterFormatId)
  }
  if (parsed.reroll > 0) {
    params.set(REROLL_PARAM, String(parsed.reroll))
  }
  params.set('v', OG_IMAGE_VERSION)
  return `/og?${params.toString()}`
}

export function buildOgUrl(parsed: ParsedShare): string {
  return `${BRAND.url}${buildOgPath(parsed)}`
}

function parseReroll(value: string | null): number | null {
  if (value === null || value === '') return 0
  if (!/^\d+$/.test(value)) return null
  const reroll = Number.parseInt(value, 10)
  if (!Number.isFinite(reroll) || reroll < 0) return null
  return reroll
}

export function parseShareParams(
  searchParams: URLSearchParams,
): ParsedShare | ShareValidationError {
  const raw = searchParams.get(PLAYER_PARAM)
  if (!raw?.trim()) return 'missing_players'

  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean)
  const formatRaw = searchParams.get(FORMAT_PARAM)
  const rosterFormatId = formatRaw
    ? parseRosterFormatId(formatRaw)
    : 'classic'
  if (!rosterFormatId) return 'invalid_format'

  if (ids.length !== rosterFormatSlotCount(rosterFormatId)) {
    return 'wrong_count'
  }

  const players: Player[] = []
  const seenPersonIds = new Set<string>()

  for (const id of ids) {
    const player = PLAYER_BY_ID.get(id)
    if (!player) return 'unknown_player'
    if (seenPersonIds.has(player.personId)) return 'duplicate_person'
    seenPersonIds.add(player.personId)
    players.push(player)
  }

  const reroll = parseReroll(searchParams.get(REROLL_PARAM))
  if (reroll === null) return 'invalid_reroll'

  return { rosterFormatId, playerIds: ids, reroll }
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
