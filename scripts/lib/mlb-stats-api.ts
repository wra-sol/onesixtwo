const MLB_STATS_BASE = 'https://statsapi.mlb.com/api/v1'

export type MlbScheduleGame = {
  gamePk: number
  gameDate: string
  status: { abstractGameState: string; detailedState: string }
  teams: {
    away: { team: { id: number; name: string } }
    home: { team: { id: number; name: string } }
  }
}

export type MlbPerson = {
  id: number
  fullName: string
  primaryPosition?: { code: string; abbreviation: string }
}

export type MlbBoxscoreTeam = {
  team: { id: number; name: string }
  battingOrder?: number[]
  pitchers?: number[]
  players: Record<
    string,
    {
      person: { id: number; fullName: string }
      position?: { abbreviation: string; code: string }
      stats?: {
        batting?: Record<string, unknown>
        pitching?: Record<string, unknown>
      }
    }
  >
}

export type MlbBoxscore = {
  teams: {
    away: MlbBoxscoreTeam
    home: MlbBoxscoreTeam
  }
}

export type MlbSeasonStatSplit = {
  stat: Record<string, string | number>
  group: { displayName: string }
  type: { displayName: string }
}

export type MlbStatGroup = {
  group: { displayName: string }
  type: { displayName: string }
  splits?: Array<{
    season?: string
    stat: Record<string, string | number>
  }>
}

export type MlbPersonWithStats = {
  id: number
  fullName: string
  primaryPosition?: { code: string; abbreviation: string }
  stats?: MlbStatGroup[]
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${MLB_STATS_BASE}${path}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`MLB Stats API ${response.status}: ${url}`)
  }
  return (await response.json()) as T
}

export function formatDateYmd(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function yesterdayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
}

export async function fetchScheduleForDate(date: string): Promise<MlbScheduleGame[]> {
  const data = await fetchJson<{
    dates?: Array<{ games?: MlbScheduleGame[] }>
  }>(`/schedule?sportId=1&date=${date}&gameType=R`)
  const games: MlbScheduleGame[] = []
  for (const day of data.dates ?? []) {
    for (const game of day.games ?? []) {
      games.push(game)
    }
  }
  return games
}

export async function fetchBoxscore(gamePk: number): Promise<MlbBoxscore> {
  return fetchJson<MlbBoxscore>(`/game/${gamePk}/boxscore`)
}

export async function fetchPersonSeasonStats(
  personId: number,
  season: number,
): Promise<MlbPersonWithStats> {
  const hydrate = encodeURIComponent(
    `stats(group=[hitting,pitching,fielding],type=season,season=${season})`,
  )
  const data = await fetchJson<{ people?: MlbPersonWithStats[] }>(
    `/people/${personId}?hydrate=${hydrate}`,
  )
  const person = data.people?.[0]
  if (!person) {
    throw new Error(`MLB person ${personId} not found`)
  }
  return person
}

export function isCompletedGame(game: MlbScheduleGame): boolean {
  return game.status.abstractGameState === 'Final'
}

export type MlbRosterEntry = {
  person: { id: number; fullName: string }
  position?: { code: string; abbreviation: string }
}

export async function fetchTeamRoster(
  mlbTeamId: number,
  season: number,
): Promise<MlbRosterEntry[]> {
  const data = await fetchJson<{ roster?: MlbRosterEntry[] }>(
    `/teams/${mlbTeamId}/roster?rosterType=active&season=${season}`,
  )
  return data.roster ?? []
}
