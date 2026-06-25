import type { LivePlayer } from './live-types'

export const DAILY_HITTER_POSITIONS = [
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'OF1',
  'OF2',
  'OF3',
  'DH',
] as const

export const DAILY_PITCHER_POSITIONS = ['SP', 'RP', 'CL'] as const

export const DAILY_LINEUP_POSITIONS = [
  ...DAILY_HITTER_POSITIONS,
  ...DAILY_PITCHER_POSITIONS,
] as const

export type DailyLineupPosition = (typeof DAILY_LINEUP_POSITIONS)[number]

export type DailyLineup = Record<DailyLineupPosition, LivePlayer | null>

export type DailyBattingOrder = LivePlayer[]

export function createEmptyDailyLineup(): DailyLineup {
  const lineup = {} as DailyLineup
  for (const pos of DAILY_LINEUP_POSITIONS) {
    lineup[pos] = null
  }
  return lineup
}

export function dailyLineupEntries(lineup: DailyLineup): Array<{
  position: DailyLineupPosition
  player: LivePlayer
}> {
  return DAILY_LINEUP_POSITIONS.flatMap((position) => {
    const player = lineup[position]
    return player ? [{ position, player }] : []
  })
}

export function dailyLineupPlayers(lineup: DailyLineup): LivePlayer[] {
  return dailyLineupEntries(lineup).map((entry) => entry.player)
}

export function dailyLineupIsComplete(lineup: DailyLineup): boolean {
  return DAILY_LINEUP_POSITIONS.every((pos) => lineup[pos] !== null)
}

export function dailyLineupOpenPositions(lineup: DailyLineup): DailyLineupPosition[] {
  return DAILY_LINEUP_POSITIONS.filter((pos) => lineup[pos] === null)
}

export function isOutfieldPosition(pos: DailyLineupPosition): boolean {
  return pos === 'OF1' || pos === 'OF2' || pos === 'OF3'
}

export function playerEligibleForDailyPosition(
  player: LivePlayer,
  position: DailyLineupPosition,
): boolean {
  if (position === 'DH') {
    return player.role === 'hitter'
  }
  if (isOutfieldPosition(position)) {
    return player.positions.some((p) => p === 'OF' || p === 'LF' || p === 'CF' || p === 'RF')
  }
  if (position === 'SP' || position === 'RP' || position === 'CL') {
    return player.pitcherRoles?.includes(position) ?? false
  }
  if (position === 'C' || position === '1B' || position === '2B' || position === '3B' || position === 'SS') {
    return player.positions.includes(position)
  }
  return false
}

export function defaultBattingOrderFromLineup(lineup: DailyLineup): DailyBattingOrder {
  const hitters = DAILY_HITTER_POSITIONS.map((pos) => lineup[pos]).filter(
    (p): p is LivePlayer => p !== null,
  )
  return [...hitters].sort((a, b) => b.grades.overall - a.grades.overall)
}

export function dailyLineupToSeed(lineup: DailyLineup): string {
  return DAILY_LINEUP_POSITIONS.map((pos) => {
    const player = lineup[pos]
    return player ? `${pos}:${player.id}` : `${pos}:empty`
  }).join('|')
}
