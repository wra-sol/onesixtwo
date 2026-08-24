import {
  fetchAllTeams,
  fetchBoxscore,
  fetchPitchArsenal,
  fetchSchedule,
  fetchSeasonStats,
  fetchTeamRoster,
  type MlbArsenalSplit,
  type MlbBoxscoreResponse,
  type MlbRosterResponse,
  type MlbScheduleResponse,
  type MlbTeamsResponse,
  type SeasonStats,
} from './mlb-client'

/**
 * Everything the snapshot builders need from MLB, as an interface. Builders
 * accept a source; they never create HTTP calls. Two adapters justify the
 * seam: httpMlbSource in production, in-memory sources in tests.
 */
export type MlbDataSource = {
  schedule(date: string): Promise<MlbScheduleResponse>
  boxscore(gamePk: number): Promise<MlbBoxscoreResponse>
  teamRoster(teamId: number, season: number): Promise<MlbRosterResponse>
  seasonStats(personId: number, season: number): Promise<SeasonStats>
  allTeams(season: number): Promise<MlbTeamsResponse>
  pitchArsenal(personId: number, season: number): Promise<MlbArsenalSplit[] | null>
}

export function httpMlbSource(): MlbDataSource {
  return {
    schedule: fetchSchedule,
    boxscore: fetchBoxscore,
    teamRoster: fetchTeamRoster,
    seasonStats: fetchSeasonStats,
    allTeams: fetchAllTeams,
    pitchArsenal: fetchPitchArsenal,
  }
}

/** Batched season-stat prefetch with a shared `${id}:${season}` cache. */
export async function batchSeasonStats(
  source: MlbDataSource,
  personIds: number[],
  season: number,
  cache: Map<string, SeasonStats>,
): Promise<void> {
  const STATS_CONCURRENCY = 10
  const uncached = personIds.filter((id) => !cache.has(`${id}:${season}`))
  for (let i = 0; i < uncached.length; i += STATS_CONCURRENCY) {
    const batch = uncached.slice(i, i + STATS_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (personId) => ({
        personId,
        stats: await source.seasonStats(personId, season),
      })),
    )
    for (const { personId, stats } of results) {
      cache.set(`${personId}:${season}`, stats)
    }
  }
}
