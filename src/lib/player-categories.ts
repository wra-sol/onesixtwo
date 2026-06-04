import type { CategoryScore, Player } from './types'
import { getPitchingRatings, getBattingRatings } from './player-ratings'

export const PLAYER_CATEGORY_LABELS = [
  'Contact',
  'Power',
  'Speed',
  'Run Production',
  'Run Prevention',
  'Control',
  'Dominance',
  'Workload',
] as const

export type PlayerCategoryLabel = (typeof PLAYER_CATEGORY_LABELS)[number]

export function getPlayerCategories(player: Player): CategoryScore[] {
  if (player.role === 'pitcher') {
    const r = getPitchingRatings(player)
    return [
      { label: 'Run Prevention', value: r.era },
      { label: 'Control', value: r.whip },
      { label: 'Dominance', value: r.strikeouts },
      { label: 'Workload', value: r.workload },
    ]
  }
  if (player.role === 'two-way') {
    const bat = getBattingRatings(player)
    const pit = getPitchingRatings(player)
    return [
      { label: 'Contact', value: bat.contact },
      { label: 'Power', value: bat.power },
      { label: 'Run Production', value: bat.runProduction },
      { label: 'Run Prevention', value: pit.era },
      { label: 'Dominance', value: pit.strikeouts },
    ]
  }
  const r = getBattingRatings(player)
  return [
    { label: 'Contact', value: r.contact },
    { label: 'Power', value: r.power },
    { label: 'Speed', value: r.speed },
    { label: 'Run Production', value: r.runProduction },
  ]
}

export function getPlayerCategoryValue(
  player: Player,
  label: string,
): number | null {
  const category = getPlayerCategories(player).find((c) => c.label === label)
  return category?.value ?? null
}

export function comparePlayersByCategory(
  a: Player,
  b: Player,
  label: string,
): number {
  const aValue = getPlayerCategoryValue(a, label)
  const bValue = getPlayerCategoryValue(b, label)
  if (aValue === null && bValue === null) return 0
  if (aValue === null) return 1
  if (bValue === null) return -1
  return bValue - aValue
}

export function getPlayerTopCategory(player: Player): CategoryScore {
  const categories = getPlayerCategories(player)
  return categories.reduce(
    (best, category) => (category.value > best.value ? category : best),
    categories[0]!,
  )
}

export function getPlayerWeakestCategory(player: Player): CategoryScore {
  const categories = getPlayerCategories(player)
  return categories.reduce(
    (worst, category) => (category.value < worst.value ? category : worst),
    categories[0]!,
  )
}
