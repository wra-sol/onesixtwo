import { getModeDataset } from '../data/modes'
import { rosterFormatSlotCount } from './roster-format'
import type { GameModeId, RosterFormatId } from './types'

export const SHARE_CODEC_VERSION = 2
export const SHARE_CODEC_VERSION_LEGACY = 1

const FORMAT_TO_CODE: Record<RosterFormatId, number> = {
  classic: 0,
  dh: 1,
  rp: 2,
  'dh-rp': 3,
}

const CODE_TO_FORMAT: RosterFormatId[] = ['classic', 'dh', 'rp', 'dh-rp']

const MODE_TO_CODE: Record<GameModeId, number> = {
  'all-time': 0,
  active: 1,
}

const CODE_TO_MODE: GameModeId[] = ['all-time', 'active']

export type ShareCodecError =
  | 'invalid_payload'
  | 'unknown_index'
  | 'wrong_count'

function sortedPlayerIdsForMode(gameModeId: GameModeId): string[] {
  return [...getModeDataset(gameModeId).players.map((player) => player.id)].sort(
    (a, b) => a.localeCompare(b),
  )
}

function indexMapsForMode(gameModeId: GameModeId) {
  const sorted = sortedPlayerIdsForMode(gameModeId)
  return {
    sorted,
    indexById: new Map(sorted.map((id, index) => [id, index])),
    idByIndex: sorted,
  }
}

/** Legacy all-time index table for v1 shares. */
const LEGACY_ALL_TIME = indexMapsForMode('all-time')
export const PLAYER_INDEX_BY_ID = LEGACY_ALL_TIME.indexById
export const PLAYER_ID_BY_INDEX = LEGACY_ALL_TIME.idByIndex

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4
  const base64 = pad === 0 ? padded : padded + '='.repeat(4 - pad)
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

export function encodeShareLineup(
  playerIds: readonly string[],
  rosterFormatId: RosterFormatId,
  gameModeId: GameModeId = 'all-time',
): string | ShareCodecError {
  const expected = rosterFormatSlotCount(rosterFormatId)
  if (playerIds.length !== expected) return 'wrong_count'

  const { indexById } = indexMapsForMode(gameModeId)
  const indices: number[] = []
  for (const id of playerIds) {
    const index = indexById.get(id)
    if (index === undefined) return 'unknown_index'
    indices.push(index)
  }

  const bytes = new Uint8Array(3 + indices.length * 2)
  bytes[0] = SHARE_CODEC_VERSION
  bytes[1] = MODE_TO_CODE[gameModeId]
  bytes[2] = FORMAT_TO_CODE[rosterFormatId]
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]!
    bytes[3 + i * 2] = (index >> 8) & 0xff
    bytes[3 + i * 2 + 1] = index & 0xff
  }

  return base64UrlEncode(bytes)
}

export function decodeShareLineup(
  encoded: string,
):
  | { gameModeId: GameModeId; rosterFormatId: RosterFormatId; playerIds: string[] }
  | ShareCodecError {
  const bytes = base64UrlDecode(encoded.trim())
  if (!bytes || bytes.length < 4) return 'invalid_payload'

  const version = bytes[0]
  if (version === SHARE_CODEC_VERSION_LEGACY) {
    const formatCode = bytes[1]
    if (formatCode === undefined || formatCode >= CODE_TO_FORMAT.length) {
      return 'invalid_payload'
    }
    const rosterFormatId = CODE_TO_FORMAT[formatCode]!
    const expected = rosterFormatSlotCount(rosterFormatId)
    if (bytes.length !== 2 + expected * 2) return 'wrong_count'

    const playerIds: string[] = []
    for (let i = 0; i < expected; i++) {
      const hi = bytes[2 + i * 2]!
      const lo = bytes[2 + i * 2 + 1]!
      const index = (hi << 8) | lo
      const id = LEGACY_ALL_TIME.idByIndex[index]
      if (!id) return 'unknown_index'
      playerIds.push(id)
    }

    return { gameModeId: 'all-time', rosterFormatId, playerIds }
  }

  if (version !== SHARE_CODEC_VERSION) return 'invalid_payload'

  const modeCode = bytes[1]
  const formatCode = bytes[2]
  if (
    modeCode === undefined ||
    formatCode === undefined ||
    modeCode >= CODE_TO_MODE.length ||
    formatCode >= CODE_TO_FORMAT.length
  ) {
    return 'invalid_payload'
  }

  const gameModeId = CODE_TO_MODE[modeCode]!
  const rosterFormatId = CODE_TO_FORMAT[formatCode]!
  const expected = rosterFormatSlotCount(rosterFormatId)
  if (bytes.length !== 3 + expected * 2) return 'wrong_count'

  const { idByIndex } = indexMapsForMode(gameModeId)
  const playerIds: string[] = []
  for (let i = 0; i < expected; i++) {
    const hi = bytes[3 + i * 2]!
    const lo = bytes[3 + i * 2 + 1]!
    const index = (hi << 8) | lo
    const id = idByIndex[index]
    if (!id) return 'unknown_index'
    playerIds.push(id)
  }

  return { gameModeId, rosterFormatId, playerIds }
}
