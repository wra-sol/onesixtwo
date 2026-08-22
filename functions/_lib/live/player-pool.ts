import type { RawPlayerInput } from '../../../shared/live/live-mlb-mapper'
import {
  fetchSeasonStats,
  fetchSeasonStatsBatched,
  fetchTeamRoster,
  getCachedSeasonStats,
} from './mlb-client'
import {
  mapPosition,
  parseBatSide,
  parseHitterStats,
  parsePitchHand,
  parsePitcherStats,
} from './mlb-parsers'

export const ROSTER_CONCURRENCY = 10

export type SeasonStats = Awaited<ReturnType<typeof fetchSeasonStats>>

export type SeasonStatsCache = Map<string, SeasonStats>

export type RawRosterInput = {
  teamId: number
  teamAbbrev: string
  teamName: string
  season: number
  statsCache: SeasonStatsCache
  /**
   * Players who appeared on the target date. They bypass PA/IP minimums so a
   * box-score star is never dropped, and are flagged appearedOnTargetDate.
   */
  appearedIds?: Set<number>
  /** Flags the produced players as fallback pool (thin primary pool). */
  isFallback?: boolean
}

/**
 * The single owner of "turn one MLB team roster into raw player inputs":
 * stat fetching/batching, PA/IP minimums, position/role mapping. Every
 * snapshot mode builds its pool through this interface.
 */
export async function buildRawFromRoster(
  input: RawRosterInput,
): Promise<RawPlayerInput[]> {
  const { teamId, teamAbbrev, teamName, season, statsCache } = input
  const appearedIds = input.appearedIds ?? new Set<number>()
  const isFallback = input.isFallback ?? false

  const roster = await fetchTeamRoster(teamId, season)
  const personIds = roster.roster.map((entry) => entry.person.id)
  await fetchSeasonStatsBatched(personIds, season, statsCache)

  const results: RawPlayerInput[] = []

  for (const entry of roster.roster) {
    const posAbbrev = entry.position.abbreviation
    const isPitcher = posAbbrev === 'P' || entry.position.code === '1'
    const { hitterSplit, pitcherSplit } = getCachedSeasonStats(
      entry.person.id,
      season,
      statsCache,
    )
    const hitterStats = parseHitterStats(hitterSplit)
    const pitcherStats = parsePitcherStats(pitcherSplit)
    const pa = hitterStats?.pa ?? 0
    const ip = pitcherStats?.ip ?? 0
    if (!isPitcher && pa < 20 && !appearedIds.has(entry.person.id)) continue
    if (isPitcher && ip < 5 && !appearedIds.has(entry.person.id)) continue

    results.push({
      personId: entry.person.id,
      name: entry.person.fullName,
      teamId,
      teamAbbrev,
      teamName,
      positions: mapPosition(entry.position.code),
      role: isPitcher ? 'pitcher' : 'hitter',
      batSide: parseBatSide(entry.person.batSide?.code),
      pitchHand: parsePitchHand(entry.person.pitchHand?.code),
      hitterStats: hitterStats ?? undefined,
      pitcherStats: pitcherStats ?? undefined,
      appearedOnTargetDate: appearedIds.has(entry.person.id),
      isFallback,
    })
  }

  return results
}
