import { PLAYER_BY_ID } from '../data'
import { BRAND } from './brand'
import {
  LINEUP_POSITIONS,
  type Lineup,
  type LineupPosition,
  type Player,
} from './types'

export type ParsedShare = {
  playerIds: readonly [string, string, string, string, string, string, string, string, string]
  reroll: number
}

export type ShareValidationError =
  | 'missing_players'
  | 'wrong_count'
  | 'unknown_player'
  | 'duplicate_person'

const PLAYER_PARAM = 'p'
const REROLL_PARAM = 'n'

function lineupPlayerIds(lineup: Lineup): string[] {
  return LINEUP_POSITIONS.map((pos) => {
    const player = lineup[pos]
    if (!player) {
      throw new Error(`Lineup missing player at ${pos}`)
    }
    return player.id
  })
}

/** Build `/share?p=...&n=...` path + query (no origin). */
export function buildSharePath(lineup: Lineup, reroll = 0): string {
  const ids = lineupPlayerIds(lineup)
  const params = new URLSearchParams()
  params.set(PLAYER_PARAM, ids.join(','))
  if (reroll > 0) {
    params.set(REROLL_PARAM, String(reroll))
  }
  return `/share?${params.toString()}`
}

/** Absolute share URL for clipboard and native share. */
export function buildShareUrl(lineup: Lineup, reroll = 0): string {
  return `${BRAND.url}${buildSharePath(lineup, reroll)}`
}

/** Build `/og?p=...&n=...` path + query for OG image endpoint. */
export function buildOgPath(parsed: ParsedShare): string {
  const params = new URLSearchParams()
  params.set(PLAYER_PARAM, parsed.playerIds.join(','))
  if (parsed.reroll > 0) {
    params.set(REROLL_PARAM, String(parsed.reroll))
  }
  return `/og?${params.toString()}`
}

export function buildOgUrl(parsed: ParsedShare): string {
  return `${BRAND.url}${buildOgPath(parsed)}`
}

function parseReroll(value: string | null): number | null {
  if (value === null || value === '') {
    return 0
  }
  if (!/^\d+$/.test(value)) {
    return null
  }
  const reroll = Number.parseInt(value, 10)
  if (!Number.isFinite(reroll) || reroll < 0) {
    return null
  }
  return reroll
}

export function parseShareParams(
  searchParams: URLSearchParams,
): ParsedShare | ShareValidationError {
  const raw = searchParams.get(PLAYER_PARAM)
  if (!raw?.trim()) {
    return 'missing_players'
  }

  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean)
  if (ids.length !== LINEUP_POSITIONS.length) {
    return 'wrong_count'
  }

  const players: Player[] = []
  const seenPersonIds = new Set<string>()

  for (const id of ids) {
    const player = PLAYER_BY_ID.get(id)
    if (!player) {
      return 'unknown_player'
    }
    if (seenPersonIds.has(player.personId)) {
      return 'duplicate_person'
    }
    seenPersonIds.add(player.personId)
    players.push(player)
  }

  const reroll = parseReroll(searchParams.get(REROLL_PARAM))
  if (reroll === null) {
    return 'wrong_count'
  }

  return {
    playerIds: ids as unknown as ParsedShare['playerIds'],
    reroll,
  }
}

export function reconstructLineup(parsed: ParsedShare): Lineup | null {
  const lineup = {} as Lineup
  for (let i = 0; i < LINEUP_POSITIONS.length; i++) {
    const pos = LINEUP_POSITIONS[i] as LineupPosition
    const player = PLAYER_BY_ID.get(parsed.playerIds[i]!)
    if (!player) {
      return null
    }
    lineup[pos] = player
  }
  return lineup
}

export function isParsedShare(
  value: ParsedShare | ShareValidationError,
): value is ParsedShare {
  return typeof value === 'object' && value !== null && 'playerIds' in value
}
