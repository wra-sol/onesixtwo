import { calculateSeasonResult } from '../../src/lib/game'
import {
  buildOgUrl,
  isParsedShare,
  parseShareParams,
  reconstructLineup,
  type ParsedShare,
} from '../../src/lib/share-url'
import {
  sharePageDescription,
  sharePageTitle,
} from '../../src/lib/use-share-page-meta'
import type { Lineup, SeasonResult } from '../../src/lib/types'

export type ResolvedShare = {
  parsed: ParsedShare
  lineup: Lineup
  result: SeasonResult
  shareUrl: string
  ogImageUrl: string
  title: string
  description: string
}

export function resolveShareFromUrl(url: URL): ResolvedShare | null {
  const parsed = parseShareParams(url.searchParams)
  if (!isParsedShare(parsed)) {
    return null
  }

  const lineup = reconstructLineup(parsed)
  if (!lineup) {
    return null
  }

  const rerollSeed =
    parsed.reroll > 0 ? String(parsed.reroll) : undefined
  const result = calculateSeasonResult(lineup, { rerollSeed })
  if (!result) {
    return null
  }

  const shareUrl = `${url.origin}${url.pathname}${url.search}`
  return {
    parsed,
    lineup,
    result,
    shareUrl,
    ogImageUrl: buildOgUrl(parsed),
    title: sharePageTitle(result.record),
    description: sharePageDescription(result, lineup),
  }
}
