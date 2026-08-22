import { BRAND, formatLineupShareSummary } from './brand'
import type { Lineup, SeasonResult } from './types'
import { LINEUP_POSITIONS } from './types'

export function sharePageTitle(record: string): string {
  return `${BRAND.name} · ${record}`
}

export function sharePageDescription(
  result: SeasonResult,
  lineup: Lineup,
): string {
  return `${result.tier.label} — ${formatLineupShareSummary(LINEUP_POSITIONS, lineup)}`
}
