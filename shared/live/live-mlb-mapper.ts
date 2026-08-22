import {
  buildLeaguePercentiles,
  gradeFromPercentile,
  overallFromGrades,
  REPLACEMENT_LEVEL,
} from './live-grades'
import type {
  LivePlayer,
  LivePlayerGrades,
  LivePlayerPosition,
  PitcherRoleSlot,
} from './live-types'

export type RawHitterStats = {
  avg?: number
  obp?: number
  slg?: number
  ops?: number
  sb?: number
  pa?: number
}

export type RawPitcherStats = {
  era?: number
  whip?: number
  k9?: number
  bb9?: number
  ip?: number
  gs?: number
  saves?: number
  g?: number
}

export type RawPlayerInput = {
  personId: number
  name: string
  teamId: number
  teamAbbrev: string
  teamName: string
  positions: LivePlayerPosition[]
  role: 'hitter' | 'pitcher'
  batSide?: 'L' | 'R' | 'S'
  pitchHand?: 'L' | 'R'
  hitterStats?: RawHitterStats
  pitcherStats?: RawPitcherStats
  appearedOnTargetDate: boolean
  isFallback: boolean
}

function invertLowerBetter(value: number, league: number[]): number {
  const max = Math.max(...league, value)
  const inverted = max - value
  const invertedLeague = league.map((v) => max - v)
  return gradeFromPercentile(inverted, invertedLeague)
}

export function buildHitterGrades(
  stats: RawHitterStats,
  league: {
    ops: number[]
    sb: number[]
    obp: number[]
  },
): LivePlayerGrades {
  const ops = stats.ops ?? (stats.obp ?? 0.3) + (stats.slg ?? 0.4)
  const contact = gradeFromPercentile(stats.obp ?? ops * 0.55, league.obp)
  const power = gradeFromPercentile(stats.slg ?? ops * 0.65, league.ops)
  const speed = gradeFromPercentile(stats.sb ?? 0, league.sb)
  const defense = REPLACEMENT_LEVEL + 10
  const partial = { contact, power, speed, defense }
  return { ...partial, overall: overallFromGrades(partial) }
}

export function buildPitcherGrades(
  stats: RawPitcherStats,
  league: {
    era: number[]
    whip: number[]
    k9: number[]
    bb9: number[]
  },
): LivePlayerGrades {
  const stuff = invertLowerBetter(stats.k9 ?? 7, league.k9)
  const command = invertLowerBetter(stats.bb9 ?? 3.5, league.bb9)
  const stamina = gradeFromPercentile(stats.ip ?? 20, buildLeaguePercentiles(league.era))
  const eraGrade = invertLowerBetter(stats.era ?? 4.5, league.era)
  const partial = {
    stuff,
    command,
    stamina,
    defense: eraGrade,
    overall: 0,
  }
  partial.overall = overallFromGrades({
    stuff,
    command,
    stamina,
  })
  return partial
}

export function derivePitcherRoles(stats: RawPitcherStats): PitcherRoleSlot[] {
  const roles: PitcherRoleSlot[] = []
  const gs = stats.gs ?? 0
  const saves = stats.saves ?? 0
  const g = stats.g ?? 0
  const relief = Math.max(0, g - gs)

  if (gs >= 1 || stats.ip === undefined) roles.push('SP')
  if (relief >= 5 || (g > 0 && gs === 0)) roles.push('RP')
  if (saves >= 3 || (relief >= 10 && saves >= 1)) roles.push('CL')
  if (roles.length === 0) roles.push('RP')
  return roles
}

export function mapRawPlayersToLive(players: RawPlayerInput[]): LivePlayer[] {
  const hitters = players.filter((p) => p.role === 'hitter' && p.hitterStats)
  const pitchers = players.filter((p) => p.role === 'pitcher' && p.pitcherStats)

  const league = {
    ops: buildLeaguePercentiles(
      hitters.map((p) => p.hitterStats!.ops ?? 0.7),
    ),
    sb: buildLeaguePercentiles(hitters.map((p) => p.hitterStats!.sb ?? 0)),
    obp: buildLeaguePercentiles(hitters.map((p) => p.hitterStats!.obp ?? 0.32)),
    era: buildLeaguePercentiles(pitchers.map((p) => p.pitcherStats!.era ?? 4.5)),
    whip: buildLeaguePercentiles(pitchers.map((p) => p.pitcherStats!.whip ?? 1.3)),
    k9: buildLeaguePercentiles(pitchers.map((p) => p.pitcherStats!.k9 ?? 8)),
    bb9: buildLeaguePercentiles(pitchers.map((p) => p.pitcherStats!.bb9 ?? 3)),
  }

  return players.map((raw) => {
    const grades =
      raw.role === 'hitter' && raw.hitterStats
        ? buildHitterGrades(raw.hitterStats, league)
        : raw.pitcherStats
          ? buildPitcherGrades(raw.pitcherStats, league)
          : { overall: REPLACEMENT_LEVEL }

    return {
      id: `mlb-${raw.personId}`,
      personId: raw.personId,
      name: raw.name,
      teamId: raw.teamId,
      teamAbbrev: raw.teamAbbrev,
      teamName: raw.teamName,
      positions: raw.positions,
      role: raw.role,
      batSide: raw.batSide,
      pitchHand: raw.pitchHand,
      grades,
      appearedOnTargetDate: raw.appearedOnTargetDate,
      isFallback: raw.isFallback,
      pitcherRoles:
        raw.role === 'pitcher' && raw.pitcherStats
          ? derivePitcherRoles(raw.pitcherStats)
          : undefined,
    }
  })
}

export function selectHighestScoringTeam<
  T extends {
    teamId: number
    teamAbbrev: string
    teamName: string
    runs: number
    hits: number
    opponentRuns: number
  },
>(games: T[]): T | null {
  if (games.length === 0) return null
  return [...games].sort((a, b) => {
    if (a.runs !== b.runs) return b.runs - a.runs
    const aDiff = a.runs - a.opponentRuns
    const bDiff = b.runs - b.opponentRuns
    if (aDiff !== bDiff) return bDiff - aDiff
    if (a.hits !== b.hits) return b.hits - a.hits
    return a.teamAbbrev.localeCompare(b.teamAbbrev)
  })[0]!
}
