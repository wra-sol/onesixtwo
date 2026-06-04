import { PLAYERS } from '../data'
import { rosterFormatSlotCount } from './roster-format'
import type { RosterFormatId } from './types'

export const SHARE_CODEC_VERSION = 1

const FORMAT_TO_CODE: Record<RosterFormatId, number> = {
  classic: 0,
  dh: 1,
  rp: 2,
  'dh-rp': 3,
}

const CODE_TO_FORMAT: RosterFormatId[] = ['classic', 'dh', 'rp', 'dh-rp']

const SORTED_PLAYER_IDS = [...PLAYERS.map((player) => player.id)].sort((a, b) =>
  a.localeCompare(b),
)

export const PLAYER_INDEX_BY_ID = new Map(
  SORTED_PLAYER_IDS.map((id, index) => [id, index]),
)

export const PLAYER_ID_BY_INDEX = SORTED_PLAYER_IDS

export type ShareCodecError =
  | 'invalid_payload'
  | 'unknown_index'
  | 'wrong_count'

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
): string | ShareCodecError {
  const expected = rosterFormatSlotCount(rosterFormatId)
  if (playerIds.length !== expected) return 'wrong_count'

  const indices: number[] = []
  for (const id of playerIds) {
    const index = PLAYER_INDEX_BY_ID.get(id)
    if (index === undefined) return 'unknown_index'
    indices.push(index)
  }

  const bytes = new Uint8Array(2 + indices.length * 2)
  bytes[0] = SHARE_CODEC_VERSION
  bytes[1] = FORMAT_TO_CODE[rosterFormatId]
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]!
    bytes[2 + i * 2] = (index >> 8) & 0xff
    bytes[2 + i * 2 + 1] = index & 0xff
  }

  return base64UrlEncode(bytes)
}

export function decodeShareLineup(
  encoded: string,
):
  | { rosterFormatId: RosterFormatId; playerIds: string[] }
  | ShareCodecError {
  const bytes = base64UrlDecode(encoded.trim())
  if (!bytes || bytes.length < 4) return 'invalid_payload'
  if (bytes[0] !== SHARE_CODEC_VERSION) return 'invalid_payload'

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
    const id = PLAYER_ID_BY_INDEX[index]
    if (!id) return 'unknown_index'
    playerIds.push(id)
  }

  return { rosterFormatId, playerIds }
}
