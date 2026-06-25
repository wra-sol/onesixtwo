import { DAILY_LINEUP_POSITIONS, type DailyLineup } from './daily-roster'

export function lineupPlayerIdsFromDailyLineup(lineup: DailyLineup): string[] {
  return DAILY_LINEUP_POSITIONS.map((pos) => lineup[pos]?.id ?? '')
}
