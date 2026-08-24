const MLB_API = 'https://statsapi.mlb.com/api/v1'

export type MlbScheduleResponse = {
  dates?: Array<{ games?: MlbScheduleGame[] }>
}

export type MlbBoxscoreResponse = {
  teams: {
    away: BoxTeam
    home: BoxTeam
  }
}

export type MlbRosterEntry = {
  person: {
    id: number
    fullName: string
    batSide?: { code: string }
    pitchHand?: { code: string }
  }
  position: { abbreviation: string; code: string }
}

export type MlbRosterResponse = { roster: MlbRosterEntry[] }

export type MlbTeamsResponse = {
  teams: Array<{ id: number; abbreviation: string; name: string }>
}

export type MlbScheduleGame = {
  gamePk: number
  status: { abstractGameState: string }
  teams: {
    away: { team: { id: number; name: string; abbreviation?: string }; score?: number }
    home: { team: { id: number; name: string; abbreviation?: string }; score?: number }
  }
}

export type BoxTeam = {
  team: { id: number; name: string; abbreviation?: string }
  teamStats?: { batting?: { hits?: number; runs?: number } }
  players: Record<
    string,
    {
      person: { id: number; fullName: string }
      position: { abbreviation: string; code: string }
      stats?: {
        batting?: Record<string, unknown>
        pitching?: Record<string, unknown>
      }
    }
  >
  batters?: number[]
  pitchers?: number[]
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`MLB API error ${response.status}: ${url}`)
  }
  return (await response.json()) as T
}

export async function fetchSchedule(date: string): Promise<MlbScheduleResponse> {
  return fetchJson<MlbScheduleResponse>(
    `${MLB_API}/schedule?sportId=1&date=${date}`,
  )
}

export async function fetchBoxscore(gamePk: number): Promise<MlbBoxscoreResponse> {
  return fetchJson<MlbBoxscoreResponse>(
    `${MLB_API}/game/${gamePk}/boxscore`,
  )
}

export async function fetchTeamRoster(
  teamId: number,
  season: number,
): Promise<MlbRosterResponse> {
  return fetchJson<MlbRosterResponse>(
    `${MLB_API}/teams/${teamId}/roster?rosterType=active&season=${season}`,
  )
}

export async function fetchSeasonStats(personId: number, season: number) {
  const [hitting, pitching] = await Promise.all([
    fetchJson<{ stats?: Array<{ splits?: Array<{ stat: Record<string, unknown> }> }> }>(
      `${MLB_API}/people/${personId}/stats?stats=season&group=hitting&season=${season}`,
    ).catch(() => null),
    fetchJson<{ stats?: Array<{ splits?: Array<{ stat: Record<string, unknown> }> }> }>(
      `${MLB_API}/people/${personId}/stats?stats=season&group=pitching&season=${season}`,
    ).catch(() => null),
  ])
  const hitterSplit = hitting?.stats?.[0]?.splits?.[0]?.stat
  const pitcherSplit = pitching?.stats?.[0]?.splits?.[0]?.stat
  return { hitterSplit, pitcherSplit }
}

export async function fetchAllTeams(season: number): Promise<MlbTeamsResponse> {
  return fetchJson<MlbTeamsResponse>(
    `${MLB_API}/teams?sportId=1&season=${season}`,
  )
}

export function seasonFromDate(date: string): number {
  const [year, month] = date.split('-').map(Number)
  return month && month >= 3 ? year! : (year ?? new Date().getFullYear()) - 1
}

export type SeasonStats = Awaited<ReturnType<typeof fetchSeasonStats>>

export type SeasonStatsCache = Map<string, SeasonStats>

export function getCachedSeasonStats(
  personId: number,
  season: number,
  cache: Map<string, Awaited<ReturnType<typeof fetchSeasonStats>>>,
) {
  return cache.get(`${personId}:${season}`) ?? { hitterSplit: undefined, pitcherSplit: undefined }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    results.push(...(await Promise.all(batch.map(fn))))
  }
  return results
}

export type MlbArsenalSplit = {
  percentage: number
  count: number
  totalPitches?: number
  averageSpeed?: number
  type: { code: string; description: string }
}

/**
 * Real pitch mix for one pitcher from MLB's pitchArsenal stat. Null when
 * the league has no tracked data (rookie without pitches, etc.) — callers
 * fall back to deterministic synthesis.
 */
export async function fetchPitchArsenal(
  personId: number,
  season: number,
): Promise<MlbArsenalSplit[] | null> {
  const data = await fetchJson<{
    stats?: Array<{ splits?: Array<{ stat?: MlbArsenalSplit }> }>
  }>(
    `${MLB_API}/people/${personId}/stats?stats=pitchArsenal&season=${season}&group=pitching`,
  ).catch(() => null)
  const splits = data?.stats?.[0]?.splits ?? []
  const usable = splits
    .map((s) => s.stat)
    .filter((s): s is MlbArsenalSplit => Boolean(s && s.type && s.percentage > 0))
  return usable.length > 0 ? usable : null
}
