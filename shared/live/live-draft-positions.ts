import {
  dailyLineupOpenPositions,
  playerEligibleForDailyPosition,
  type DailyLineup,
  type DailyLineupPosition,
} from './daily-roster'
import type { LivePlayer } from './live-types'

const POSITION_PRIORITY: DailyLineupPosition[] = [
  'SP',
  'CL',
  'RP',
  'C',
  'SS',
  '1B',
  '2B',
  '3B',
  'OF1',
  'OF2',
  'OF3',
  'DH',
]

export function bestOpenPosition(
  player: LivePlayer,
  lineup: DailyLineup,
): DailyLineupPosition | null {
  const open = dailyLineupOpenPositions(lineup)
  const eligible = open.filter((pos) => playerEligibleForDailyPosition(player, pos))
  if (eligible.length === 0) return null

  for (const pos of POSITION_PRIORITY) {
    if (eligible.includes(pos)) return pos
  }
  return eligible[0] ?? null
}

export function pickableFromPool(
  pool: LivePlayer[],
  lineup: DailyLineup,
): LivePlayer[] {
  return pool.filter((player) => bestOpenPosition(player, lineup) !== null)
}
