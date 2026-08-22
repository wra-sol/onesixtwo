import type { LivePlayer } from './live-types'

export const ROSTER25_HITTER_SLOTS = [
  'C1',
  'C2',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'DH',
  'BENCH1',
  'BENCH2',
  'BENCH3',
] as const

export const ROSTER25_PITCHER_SLOTS = [
  'SP1',
  'SP2',
  'SP3',
  'SP4',
  'SP5',
  'RP1',
  'RP2',
  'RP3',
  'RP4',
  'RP5',
  'RP6',
  'CL',
] as const

export const ROSTER25_POSITION_SLOTS = [
  ...ROSTER25_HITTER_SLOTS,
  ...ROSTER25_PITCHER_SLOTS,
] as const

export type Roster25Slot = (typeof ROSTER25_POSITION_SLOTS)[number]

export type Roster25 = Record<Roster25Slot, LivePlayer | null>

export const ROSTER25_BATTING_ORDER_SLOTS = [
  'C1',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'DH',
] as const

const ROTATION_SLOTS = ['SP1', 'SP2', 'SP3', 'SP4', 'SP5'] as const
const BULLPEN_SLOTS = ['RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6', 'CL'] as const
const BENCH_SLOTS = ['BENCH1', 'BENCH2', 'BENCH3'] as const

export function createEmptyRoster25(): Roster25 {
  const roster = {} as Roster25
  for (const slot of ROSTER25_POSITION_SLOTS) {
    roster[slot] = null
  }
  return roster
}

export function roster25Entries(
  roster: Roster25,
): Array<{ slot: Roster25Slot; player: LivePlayer }> {
  return ROSTER25_POSITION_SLOTS.flatMap((slot) => {
    const player = roster[slot]
    return player ? [{ slot, player }] : []
  })
}

export function roster25Players(roster: Roster25): LivePlayer[] {
  return roster25Entries(roster).map((entry) => entry.player)
}

export function roster25IsComplete(roster: Roster25): boolean {
  return ROSTER25_POSITION_SLOTS.every((slot) => roster[slot] !== null)
}

export function roster25OpenSlots(roster: Roster25): Roster25Slot[] {
  return ROSTER25_POSITION_SLOTS.filter((slot) => roster[slot] === null)
}

export function roster25QuotaFills(
  roster: Roster25,
): Array<{ slot: Roster25Slot; filled: boolean }> {
  return ROSTER25_POSITION_SLOTS.map((slot) => ({ slot, filled: roster[slot] !== null }))
}

export function roster25Rotation(roster: Roster25): LivePlayer[] {
  return ROTATION_SLOTS.map((slot) => roster[slot]).filter(
    (p): p is LivePlayer => p !== null,
  )
}

export function roster25Bullpen(roster: Roster25): LivePlayer[] {
  return BULLPEN_SLOTS.map((slot) => roster[slot]).filter(
    (p): p is LivePlayer => p !== null,
  )
}

export function roster25Bench(roster: Roster25): LivePlayer[] {
  return BENCH_SLOTS.map((slot) => roster[slot]).filter(
    (p): p is LivePlayer => p !== null,
  )
}

export function roster25BattingOrder(roster: Roster25): LivePlayer[] {
  const starters = ROSTER25_BATTING_ORDER_SLOTS.map((slot) => roster[slot]).filter(
    (p): p is LivePlayer => p !== null,
  )
  return [...starters].sort((a, b) => b.grades.overall - a.grades.overall)
}

function isOutfieldSlot(slot: Roster25Slot): boolean {
  return slot === 'LF' || slot === 'CF' || slot === 'RF'
}

function isBenchSlot(slot: Roster25Slot): boolean {
  return slot === 'BENCH1' || slot === 'BENCH2' || slot === 'BENCH3'
}

function isRotationSlot(slot: Roster25Slot): boolean {
  return (
    slot === 'SP1' ||
    slot === 'SP2' ||
    slot === 'SP3' ||
    slot === 'SP4' ||
    slot === 'SP5'
  )
}

function isRelieverSlot(slot: Roster25Slot): boolean {
  return (
    slot === 'RP1' ||
    slot === 'RP2' ||
    slot === 'RP3' ||
    slot === 'RP4' ||
    slot === 'RP5' ||
    slot === 'RP6'
  )
}

export function playerEligibleForRoster25Slot(
  player: LivePlayer,
  slot: Roster25Slot,
): boolean {
  if (slot === 'C1' || slot === 'C2') {
    return player.role === 'hitter' && player.positions.includes('C')
  }
  if (slot === '1B' || slot === '2B' || slot === '3B' || slot === 'SS') {
    return player.role === 'hitter' && player.positions.includes(slot)
  }
  if (isOutfieldSlot(slot)) {
    return (
      player.role === 'hitter' &&
      player.positions.some((p) => p === 'OF' || p === 'LF' || p === 'CF' || p === 'RF')
    )
  }
  if (slot === 'DH') {
    return player.role === 'hitter'
  }
  if (isBenchSlot(slot)) {
    return player.role === 'hitter'
  }
  if (isRotationSlot(slot)) {
    return player.role === 'pitcher' && (player.pitcherRoles?.includes('SP') ?? false)
  }
  if (isRelieverSlot(slot)) {
    return player.role === 'pitcher' && (player.pitcherRoles?.includes('RP') ?? false)
  }
  if (slot === 'CL') {
    return (
      player.role === 'pitcher' &&
      ((player.pitcherRoles?.includes('CL') ?? false) ||
        (player.pitcherRoles?.includes('RP') ?? false))
    )
  }
  return false
}

export function roster25ToSeed(roster: Roster25): string {
  return ROSTER25_POSITION_SLOTS.map((slot) => {
    const player = roster[slot]
    return player ? `${slot}:${player.id}` : `${slot}:empty`
  }).join('|')
}

/**
 * Encodes a roster as positionally ordered player ids (share-link format).
 * The slot↔index mapping is owned here so encode and decode can never drift.
 */
export function roster25ToPlayerIds(roster: Roster25): string[] {
  return ROSTER25_POSITION_SLOTS.map((slot) => roster[slot]?.id).filter(
    (id): id is string => Boolean(id),
  )
}

/**
 * Decodes positionally ordered player ids back into a roster. Unknown ids
 * leave their slot empty; check roster25IsComplete before simulating.
 */
export function roster25FromPlayerIds(
  playerIds: readonly string[],
  playersById: Map<string, LivePlayer>,
): Roster25 {
  const roster = createEmptyRoster25()
  playerIds.forEach((id, index) => {
    const slot = ROSTER25_POSITION_SLOTS[index]
    const player = playersById.get(id)
    if (slot && player) {
      roster[slot] = player
    }
  })
  return roster
}
