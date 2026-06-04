import type { Lineup, LineupPosition, Player, RosterFormatId } from './types'

export type { RosterFormatId } from './types'

export const BASE_LINEUP_POSITIONS = [
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'SP',
] as const satisfies readonly LineupPosition[]

/** Classic nine — backward-compatible alias. */
export const LINEUP_POSITIONS = BASE_LINEUP_POSITIONS

export const OPTIONAL_LINEUP_POSITIONS = ['DH', 'RP'] as const satisfies readonly LineupPosition[]

export const ALL_LINEUP_POSITIONS = [
  ...BASE_LINEUP_POSITIONS,
  ...OPTIONAL_LINEUP_POSITIONS,
] as const satisfies readonly LineupPosition[]

export type RosterFormat = {
  id: RosterFormatId
  label: string
  positions: LineupPosition[]
}

export const ROSTER_FORMATS: RosterFormat[] = [
  {
    id: 'classic',
    label: 'Classic (9)',
    positions: [...BASE_LINEUP_POSITIONS],
  },
  {
    id: 'dh',
    label: '+ DH (10)',
    positions: [...BASE_LINEUP_POSITIONS, 'DH'],
  },
  {
    id: 'rp',
    label: '+ RP (10)',
    positions: [...BASE_LINEUP_POSITIONS, 'RP'],
  },
  {
    id: 'dh-rp',
    label: '+ DH & RP (11)',
    positions: [...BASE_LINEUP_POSITIONS, 'DH', 'RP'],
  },
]

export function getRosterFormat(id: RosterFormatId): RosterFormat {
  const format = ROSTER_FORMATS.find((f) => f.id === id)
  return format ?? ROSTER_FORMATS[0]!
}

export function getActiveLineupPositions(formatId: RosterFormatId): LineupPosition[] {
  return [...getRosterFormat(formatId).positions]
}

export function rosterFormatSlotCount(formatId: RosterFormatId): number {
  return getActiveLineupPositions(formatId).length
}

/** All lineup slots start empty; active slots come from `getActiveLineupPositions`. */
export function createEmptyLineup(): Lineup {
  const lineup = {} as Lineup
  for (const pos of ALL_LINEUP_POSITIONS) {
    lineup[pos] = null
  }
  return lineup
}

export type LineupEntry = {
  position: LineupPosition
  player: Player
}

export function lineupEntries(
  lineup: Lineup,
  formatId: RosterFormatId,
): LineupEntry[] {
  return getActiveLineupPositions(formatId)
    .map((position) => {
      const player = lineup[position]
      return player ? { position, player } : null
    })
    .filter((entry): entry is LineupEntry => entry !== null)
}

export function lineupPlayers(lineup: Lineup, formatId: RosterFormatId): Player[] {
  return lineupEntries(lineup, formatId).map((e) => e.player)
}

/** Stable simulation seed from lineup personIds and positions. */
export function lineupToSeed(
  lineup: Lineup,
  formatId: RosterFormatId = 'classic',
): string {
  const parts = getActiveLineupPositions(formatId).map((pos) => {
    const player = lineup[pos]
    return player ? `${pos}:${player.personId}` : `${pos}:empty`
  })
  return parts.join('|')
}

export function parseRosterFormatId(value: string | null): RosterFormatId | null {
  if (
    value === 'classic' ||
    value === 'dh' ||
    value === 'rp' ||
    value === 'dh-rp'
  ) {
    return value
  }
  return null
}
