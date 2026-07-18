import { createSeededRandomFromString, hashSeed } from './rng'

export type League = 'AL' | 'NL'
export type Division =
  | 'AL-East'
  | 'AL-Central'
  | 'AL-West'
  | 'NL-East'
  | 'NL-Central'
  | 'NL-West'

export type TeamStrength = {
  teamId: string
  teamName: string
  league: League
  division: Division
  strength: number
}

export type TeamRecord = { teamId: string; wins: number; losses: number }

export type Standings = {
  records: TeamRecord[]
  byDivision: Record<Division, TeamRecord[]>
  byLeague: Record<League, TeamRecord[]>
}

export type PlayoffSeed = {
  seed: number
  teamId: string
  isDivisionWinner: boolean
  isWildCard: boolean
  record: TeamRecord
}

export type PlayoffField = { league: League; seeds: PlayoffSeed[] }

export const LEAGUE_SCHEDULE_LENGTH = 162

const PER_GAME_VARIANCE = 0.08
const INITIAL_SEASON_VARIANCE = 12
const ELITE_SEASON_VARIANCE = 16
const PERFECT_SEASON_THRESHOLD = 95
const PERFECT_SEASON_MIN_SCORE = 93

const ALL_DIVISIONS: Division[] = [
  'AL-East',
  'AL-Central',
  'AL-West',
  'NL-East',
  'NL-Central',
  'NL-West',
]

const AL_DIVISIONS: Division[] = ['AL-East', 'AL-Central', 'AL-West']
const NL_DIVISIONS: Division[] = ['NL-East', 'NL-Central', 'NL-West']

type TeamMeta = {
  teamId: string
  teamName: string
  league: League
  division: Division
}

const TEAMS: TeamMeta[] = [
  { teamId: 'yankees', teamName: 'New York Yankees', league: 'AL', division: 'AL-East' },
  { teamId: 'red-sox', teamName: 'Boston Red Sox', league: 'AL', division: 'AL-East' },
  { teamId: 'rays', teamName: 'Tampa Bay Rays', league: 'AL', division: 'AL-East' },
  { teamId: 'blue-jays', teamName: 'Toronto Blue Jays', league: 'AL', division: 'AL-East' },
  { teamId: 'orioles', teamName: 'Baltimore Orioles', league: 'AL', division: 'AL-East' },
  { teamId: 'white-sox', teamName: 'Chicago White Sox', league: 'AL', division: 'AL-Central' },
  { teamId: 'guardians', teamName: 'Cleveland Guardians', league: 'AL', division: 'AL-Central' },
  { teamId: 'tigers', teamName: 'Detroit Tigers', league: 'AL', division: 'AL-Central' },
  { teamId: 'royals', teamName: 'Kansas City Royals', league: 'AL', division: 'AL-Central' },
  { teamId: 'twins', teamName: 'Minnesota Twins', league: 'AL', division: 'AL-Central' },
  { teamId: 'astros', teamName: 'Houston Astros', league: 'AL', division: 'AL-West' },
  { teamId: 'angels', teamName: 'Los Angeles Angels', league: 'AL', division: 'AL-West' },
  { teamId: 'athletics', teamName: 'Oakland Athletics', league: 'AL', division: 'AL-West' },
  { teamId: 'mariners', teamName: 'Seattle Mariners', league: 'AL', division: 'AL-West' },
  { teamId: 'rangers', teamName: 'Texas Rangers', league: 'AL', division: 'AL-West' },
  { teamId: 'braves', teamName: 'Atlanta Braves', league: 'NL', division: 'NL-East' },
  { teamId: 'marlins', teamName: 'Miami Marlins', league: 'NL', division: 'NL-East' },
  { teamId: 'mets', teamName: 'New York Mets', league: 'NL', division: 'NL-East' },
  { teamId: 'phillies', teamName: 'Philadelphia Phillies', league: 'NL', division: 'NL-East' },
  { teamId: 'nationals', teamName: 'Washington Nationals', league: 'NL', division: 'NL-East' },
  { teamId: 'cubs', teamName: 'Chicago Cubs', league: 'NL', division: 'NL-Central' },
  { teamId: 'reds', teamName: 'Cincinnati Reds', league: 'NL', division: 'NL-Central' },
  { teamId: 'brewers', teamName: 'Milwaukee Brewers', league: 'NL', division: 'NL-Central' },
  { teamId: 'pirates', teamName: 'Pittsburgh Pirates', league: 'NL', division: 'NL-Central' },
  { teamId: 'cardinals', teamName: 'St. Louis Cardinals', league: 'NL', division: 'NL-Central' },
  { teamId: 'dodgers', teamName: 'Los Angeles Dodgers', league: 'NL', division: 'NL-West' },
  { teamId: 'giants', teamName: 'San Francisco Giants', league: 'NL', division: 'NL-West' },
  { teamId: 'padres', teamName: 'San Diego Padres', league: 'NL', division: 'NL-West' },
  { teamId: 'rockies', teamName: 'Colorado Rockies', league: 'NL', division: 'NL-West' },
  { teamId: 'diamondbacks', teamName: 'Arizona Diamondbacks', league: 'NL', division: 'NL-West' },
]

const TEAM_BY_ID: Map<string, TeamMeta> = new Map(TEAMS.map((t) => [t.teamId, t]))

const DIVISION_TEAMS: Record<Division, string[]> = ALL_DIVISIONS.reduce(
  (acc, div) => {
    acc[div] = TEAMS.filter((t) => t.division === div).map((t) => t.teamId)
    return acc
  },
  {} as Record<Division, string[]>,
)

function divisionsInLeague(league: League): Division[] {
  return league === 'AL' ? AL_DIVISIONS : NL_DIVISIONS
}

export function teamDivision(teamId: string): Division {
  const meta = TEAM_BY_ID.get(teamId)
  if (!meta) throw new Error(`Unknown team id: ${teamId}`)
  return meta.division
}

export function teamLeague(teamId: string): League {
  const meta = TEAM_BY_ID.get(teamId)
  if (!meta) throw new Error(`Unknown team id: ${teamId}`)
  return meta.league
}

export function buildLeagueStrengths(
  strengthByTeamId: Record<string, number>,
): TeamStrength[] {
  return TEAMS.map((t) => ({
    teamId: t.teamId,
    teamName: t.teamName,
    league: t.league,
    division: t.division,
    strength: strengthByTeamId[t.teamId] ?? 50,
  }))
}

function projectWins(teamScore: number): { wins: number; losses: number } {
  let wins: number
  if (teamScore < 50) {
    wins = Math.round(teamScore * 1.62)
  } else if (teamScore < 75) {
    wins = Math.round(81 + ((teamScore - 50) / 25) * 24)
  } else if (teamScore < 90) {
    wins = Math.round(105 + ((teamScore - 75) / 15) * 20)
  } else if (teamScore < 100) {
    wins = Math.round(128 + ((teamScore - 90) / 10) * 44)
  } else {
    wins = LEAGUE_SCHEDULE_LENGTH
  }
  wins = Math.min(LEAGUE_SCHEDULE_LENGTH, Math.max(0, wins))
  return { wins, losses: LEAGUE_SCHEDULE_LENGTH - wins }
}

function baselineWinProbability(teamScore: number): number {
  return projectWins(teamScore).wins / LEAGUE_SCHEDULE_LENGTH
}

function winProbabilityCeiling(teamScore: number): number {
  if (teamScore >= 98) return 0.99
  if (teamScore >= 95) return 0.98
  if (teamScore >= 90) return 0.94
  return 0.92
}

function gameWinProbability(teamScore: number, random: () => number): number {
  const base = baselineWinProbability(teamScore)
  const swing = (random() - 0.5) * PER_GAME_VARIANCE
  const ceiling = winProbabilityCeiling(teamScore)
  return Math.min(ceiling, Math.max(0.08, base + swing))
}

function seasonVarianceCap(teamScore: number): number {
  if (teamScore >= 95) return ELITE_SEASON_VARIANCE
  if (teamScore >= 90) return INITIAL_SEASON_VARIANCE + 2
  return INITIAL_SEASON_VARIANCE
}

function clampWins(wins: number, teamScore: number, expectedWins: number): number {
  let clamped = Math.min(
    LEAGUE_SCHEDULE_LENGTH,
    Math.max(0, wins),
  )
  const cap = seasonVarianceCap(teamScore)
  const minWins = Math.max(0, expectedWins - cap)
  const maxWins = Math.min(LEAGUE_SCHEDULE_LENGTH, expectedWins + cap)
  clamped = Math.min(maxWins, Math.max(minWins, clamped))

  if (teamScore < PERFECT_SEASON_MIN_SCORE && clamped === LEAGUE_SCHEDULE_LENGTH) {
    clamped = LEAGUE_SCHEDULE_LENGTH - 1
  }
  if (
    teamScore < PERFECT_SEASON_THRESHOLD &&
    clamped >= LEAGUE_SCHEDULE_LENGTH - 5
  ) {
    clamped = Math.min(clamped, LEAGUE_SCHEDULE_LENGTH - 6)
  }
  return clamped
}

function simulateTeamSeason(teamId: string, teamScore: number, seed: string): number {
  const random = createSeededRandomFromString(`${seed}|season|${teamId}`)
  const expected = projectWins(teamScore).wins
  let wins = 0
  for (let i = 0; i < LEAGUE_SCHEDULE_LENGTH; i += 1) {
    const winProb = gameWinProbability(teamScore, random)
    if (random() < winProb) wins += 1
  }
  return clampWins(wins, teamScore, expected)
}

function tiebreakSort(records: TeamRecord[]): TeamRecord[] {
  return [...records].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    const ha = hashSeed(a.teamId)
    const hb = hashSeed(b.teamId)
    return hb - ha
  })
}

export function simulateCoarseSeason(
  strengths: TeamStrength[],
  seed: string,
): Standings {
  const byId = new Map(strengths.map((s) => [s.teamId, s]))
  const records: TeamRecord[] = TEAMS.map((meta) => {
    const entry = byId.get(meta.teamId)
    const strength = entry?.strength ?? 50
    const wins = simulateTeamSeason(meta.teamId, strength, seed)
    return {
      teamId: meta.teamId,
      wins,
      losses: LEAGUE_SCHEDULE_LENGTH - wins,
    }
  })

  const byDivision = {} as Record<Division, TeamRecord[]>
  for (const div of ALL_DIVISIONS) {
    byDivision[div] = tiebreakSort(
      records.filter((r) => teamDivision(r.teamId) === div),
    )
  }

  const byLeague = { AL: [] as TeamRecord[], NL: [] as TeamRecord[] }
  for (const meta of TEAMS) {
    byLeague[meta.league].push(records.find((r) => r.teamId === meta.teamId)!)
  }
  byLeague.AL = tiebreakSort(byLeague.AL)
  byLeague.NL = tiebreakSort(byLeague.NL)

  return {
    records: tiebreakSort(records),
    byDivision,
    byLeague,
  }
}

export function generateSchedule(
  seed: string,
): Array<{ away: string; home: string; gameIndex: number }> {
  const random = createSeededRandomFromString(`${seed}|schedule`)
  const games: Array<{ away: string; home: string }> = []

  const addSeries = (a: string, b: string, count: number) => {
    for (let g = 0; g < count; g += 1) {
      const aHome = random() < 0.5
      games.push({ away: aHome ? b : a, home: aHome ? a : b })
    }
  }

  for (const div of ALL_DIVISIONS) {
    const teams = DIVISION_TEAMS[div]
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        addSeries(teams[i]!, teams[j]!, 13)
      }
    }
  }

  for (const league of ['AL', 'NL'] as League[]) {
    const leagueTeams = TEAMS.filter((t) => t.league === league).map((t) => t.teamId)
    for (let i = 0; i < leagueTeams.length; i += 1) {
      for (let j = i + 1; j < leagueTeams.length; j += 1) {
        if (teamDivision(leagueTeams[i]!) === teamDivision(leagueTeams[j]!)) continue
        addSeries(leagueTeams[i]!, leagueTeams[j]!, 6)
      }
    }
  }

  const offset = Math.floor(random() * 3)
  for (let i = 0; i < 3; i += 1) {
    const alDiv = AL_DIVISIONS[i]!
    const nlDiv = NL_DIVISIONS[(i + offset) % 3]!
    const alTeams = DIVISION_TEAMS[alDiv]
    const nlTeams = DIVISION_TEAMS[nlDiv]
    for (const a of alTeams) {
      for (const b of nlTeams) {
        addSeries(a, b, 10)
      }
    }
  }

  for (let i = games.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const tmp = games[i]!
    games[i] = games[j]!
    games[j] = tmp
  }

  return games.map((g, idx) => ({
    away: g.away,
    home: g.home,
    gameIndex: idx,
  }))
}

export function buildPlayoffField(standings: Standings): PlayoffField[] {
  const leagues: League[] = ['AL', 'NL']
  return leagues.map((league) => {
    const leagueRecords = standings.byLeague[league]
    const divisionWinners: TeamRecord[] = []
    for (const div of divisionsInLeague(league)) {
      const teams = standings.byDivision[div]
      divisionWinners.push(tiebreakSort(teams)[0])
    }

    const winnerIds = new Set(divisionWinners.map((r) => r.teamId))
    const wildCards = tiebreakSort(
      leagueRecords.filter((r) => !winnerIds.has(r.teamId)),
    ).slice(0, 3)

    const sortedWinners = tiebreakSort(divisionWinners)
    const seeds: PlayoffSeed[] = []
    sortedWinners.forEach((record, idx) => {
      seeds.push({
        seed: idx + 1,
        teamId: record.teamId,
        isDivisionWinner: true,
        isWildCard: false,
        record,
      })
    })
    wildCards.forEach((record, idx) => {
      seeds.push({
        seed: sortedWinners.length + idx + 1,
        teamId: record.teamId,
        isDivisionWinner: false,
        isWildCard: true,
        record,
      })
    })

    return { league, seeds }
  })
}
