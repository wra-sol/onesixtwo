import { calculateSeasonResult } from '../../src/lib/game'
import {
  buildOgPath,
  isParsedShare,
  parseShareParams,
  reconstructLineup,
  type ParsedShare,
  type ShareValidationError,
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

export type ShareResolveFailure =
  | { kind: 'validation'; error: ShareValidationError }
  | { kind: 'lineup_unavailable' }
  | { kind: 'simulation_failed' }

export function resolveShareFromUrl(
  url: URL,
): ResolvedShare | ShareResolveFailure {
  const parsed = parseShareParams(url.searchParams)
  if (!isParsedShare(parsed)) {
    return { kind: 'validation', error: parsed }
  }

  const lineup = reconstructLineup(parsed)
  if (!lineup) {
    return { kind: 'lineup_unavailable' }
  }

  const result = calculateSeasonResult(lineup, {
    rerollSeed: String(parsed.reroll),
    rosterFormatId: parsed.rosterFormatId,
  })
  if (!result) {
    return { kind: 'simulation_failed' }
  }

  const shareUrl = `${url.origin}${url.pathname}${url.search}`
  return {
    parsed,
    lineup,
    result,
    shareUrl,
    ogImageUrl: `${url.origin}${buildOgPath(parsed)}`,
    title: sharePageTitle(result.record),
    description: sharePageDescription(result, lineup),
  }
}
