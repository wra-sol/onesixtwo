import type { LiveDraftSnapshot } from '../../../shared/live/live-types'
import { mapRawPlayersToLive, type RawPlayerInput } from '../../../shared/live/live-mlb-mapper'
import { seededCoinFlip } from '../../../shared/live/rng'
import {
  fetchAllTeams,
  fetchSeasonStatsBatched,
  fetchTeamRoster,
  getCachedSeasonStats,
  mapWithConcurrency,
  seasonFromDate,
} from './mlb-client'
import {
  mapPosition,
  parseBatSide,
  parseHitterStats,
  parsePitchHand,
  parsePitcherStats,
} from './mlb-parsers'

const ROSTER_CONCURRENCY = 10

async function buildRawFromRoster(
  teamId: number,
  teamAbbrev: string,
  teamName: string,
  season: number,
  statsCache: Map<string, Awaited<ReturnType<typeof import('./mlb-client').fetchSeasonStats>>>,
): Promise<RawPlayerInput[]> {
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
    if (!isPitcher && pa < 20) continue
    if (isPitcher && ip < 5) continue

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
      appearedOnTargetDate: false,
      isFallback: false,
    })
  }

  return results
}

export async function buildLiveDraftSnapshot(
  challengeDate: string,
): Promise<LiveDraftSnapshot> {
  const season = seasonFromDate(challengeDate)
  const teams = await fetchAllTeams(season)
  const statsCache = new Map<
    string,
    Awaited<ReturnType<typeof import('./mlb-client').fetchSeasonStats>>
  >()

  const rosterChunks = await mapWithConcurrency(
    teams.teams,
    ROSTER_CONCURRENCY,
    async (team) =>
      buildRawFromRoster(team.id, team.abbreviation, team.name, season, statsCache),
  )
  const rawPlayers = rosterChunks.flat()
  const players = mapRawPlayersToLive(rawPlayers)
  const coinFlipUserFirst = seededCoinFlip(challengeDate)

  return {
    kind: 'live-draft',
    challengeDate,
    players,
    coinFlipUserFirst,
    simSeed: `${challengeDate}|live-draft`,
  }
}
