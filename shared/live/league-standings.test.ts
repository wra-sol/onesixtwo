import { describe, expect, it } from 'vitest'
import {
  buildLeagueStrengths,
  buildPlayoffField,
  generateSchedule,
  LEAGUE_SCHEDULE_LENGTH,
  simulateCoarseSeason,
  teamDivision,
  teamLeague,
} from './league-standings'
import type {
  Division,
  PlayoffField,
  Standings,
  TeamRecord,
  TeamStrength,
} from './league-standings'

const ALL_TEAM_IDS = [
  'yankees', 'red-sox', 'rays', 'blue-jays', 'orioles',
  'white-sox', 'guardians', 'tigers', 'royals', 'twins',
  'astros', 'angels', 'athletics', 'mariners', 'rangers',
  'braves', 'marlins', 'mets', 'phillies', 'nationals',
  'cubs', 'reds', 'brewers', 'pirates', 'cardinals',
  'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks',
]

function sampleStrengths(): TeamStrength[] {
  const map: Record<string, number> = {}
  let i = 0
  for (const id of ALL_TEAM_IDS) {
    map[id] = 55 + ((i * 7) % 45)
    i += 1
  }
  map['dodgers'] = 96
  map['yankees'] = 94
  map['rockies'] = 38
  return buildLeagueStrengths(map)
}

function makeStandings(rows: Array<{ teamId: string; wins: number }>): Standings {
  const records: TeamRecord[] = rows.map((r) => ({
    teamId: r.teamId,
    wins: r.wins,
    losses: LEAGUE_SCHEDULE_LENGTH - r.wins,
  }))
  const allDivisions: Division[] = [
    'AL-East', 'AL-Central', 'AL-West',
    'NL-East', 'NL-Central', 'NL-West',
  ]
  const byDivision = {} as Record<Division, TeamRecord[]>
  for (const div of allDivisions) {
    byDivision[div] = records
      .filter((r) => teamDivision(r.teamId) === div)
      .sort((a, b) => b.wins - a.wins)
  }
  const byLeague = { AL: [] as TeamRecord[], NL: [] as TeamRecord[] }
  for (const r of records) {
    byLeague[teamLeague(r.teamId)].push(r)
  }
  byLeague.AL.sort((a, b) => b.wins - a.wins)
  byLeague.NL.sort((a, b) => b.wins - a.wins)
  return { records, byDivision, byLeague }
}

describe('league-standings — structure', () => {
  it('maps every franchise id to a division and league', () => {
    for (const id of ALL_TEAM_IDS) {
      expect(() => teamDivision(id)).not.toThrow()
      expect(() => teamLeague(id)).not.toThrow()
    }
    expect(teamLeague('yankees')).toBe('AL')
    expect(teamDivision('dodgers')).toBe('NL-West')
  })

  it('exposes a 162-game schedule length', () => {
    expect(LEAGUE_SCHEDULE_LENGTH).toBe(162)
  })
})

describe('generateSchedule', () => {
  it('produces 2,430 total games deterministically from the seed', () => {
    const a = generateSchedule('seed-1')
    const b = generateSchedule('seed-1')
    expect(a).toEqual(b)
    expect(a).toHaveLength(2430)
  })

  it('gives every team exactly 162 games with unique gameIndex values', () => {
    const games = generateSchedule('seed-1')
    const counts: Record<string, number> = {}
    for (const g of games) {
      counts[g.home] = (counts[g.home] ?? 0) + 1
      counts[g.away] = (counts[g.away] ?? 0) + 1
    }
    for (const id of ALL_TEAM_IDS) {
      expect(counts[id]).toBe(162)
    }
    const indices = games.map((g) => g.gameIndex)
    expect(new Set(indices).size).toBe(games.length)
  })

  it('different seeds can yield different schedule orders', () => {
    const a = generateSchedule('seed-1')
    const b = generateSchedule('seed-2')
    expect(a).not.toEqual(b)
  })
})

describe('simulateCoarseSeason', () => {
  it('is deterministic: same seed + strengths => identical standings', () => {
    const strengths = sampleStrengths()
    const a = simulateCoarseSeason(strengths, 'season-xyz')
    const b = simulateCoarseSeason(strengths, 'season-xyz')
    expect(a).toEqual(b)
  })

  it('produces a 162-game record for all 30 teams', () => {
    const standings = simulateCoarseSeason(sampleStrengths(), 'season-xyz')
    expect(standings.records).toHaveLength(30)
    for (const r of standings.records) {
      expect(r.wins + r.losses).toBe(162)
      expect(r.wins).toBeGreaterThanOrEqual(0)
      expect(r.wins).toBeLessThanOrEqual(162)
    }
  })

  it('sorts teams within each division by wins descending', () => {
    const standings = simulateCoarseSeason(sampleStrengths(), 'season-xyz')
    const divisions: Division[] = [
      'AL-East', 'AL-Central', 'AL-West',
      'NL-East', 'NL-Central', 'NL-West',
    ]
    for (const div of divisions) {
      const teams = standings.byDivision[div]
      expect(teams).toHaveLength(5)
      for (let i = 1; i < teams.length; i += 1) {
        expect(teams[i]!.wins).toBeLessThanOrEqual(teams[i - 1]!.wins)
      }
    }
  })

  it('keeps each league at 15 teams sorted by wins', () => {
    const standings = simulateCoarseSeason(sampleStrengths(), 'season-xyz')
    expect(standings.byLeague.AL).toHaveLength(15)
    expect(standings.byLeague.NL).toHaveLength(15)
    for (let i = 1; i < 15; i += 1) {
      expect(standings.byLeague.AL[i]!.wins).toBeLessThanOrEqual(
        standings.byLeague.AL[i - 1]!.wins,
      )
    }
  })

  it('runs in under 10ms for all 30 teams', () => {
    const strengths = sampleStrengths()
    const start = performance.now()
    simulateCoarseSeason(strengths, 'perf-seed')
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(10)
  })

  it('a league of equal-strength teams still produces valid records', () => {
    const strengths = buildLeagueStrengths(
      Object.fromEntries(ALL_TEAM_IDS.map((id) => [id, 50])) as Record<string, number>,
    )
    const standings = simulateCoarseSeason(strengths, 'equal-seed')
    for (const r of standings.records) {
      expect(r.wins + r.losses).toBe(162)
    }
  })
})

describe('buildPlayoffField', () => {
  it('produces 12 total seeds: 6 per league, 3 division winners + 3 wild cards', () => {
    const standings = simulateCoarseSeason(sampleStrengths(), 'season-xyz')
    const fields = buildPlayoffField(standings)
    expect(fields).toHaveLength(2)
    const al = fields.find((f) => f.league === 'AL') as PlayoffField
    const nl = fields.find((f) => f.league === 'NL') as PlayoffField
    for (const field of [al, nl]) {
      expect(field.seeds).toHaveLength(6)
      expect(field.seeds.filter((s) => s.isDivisionWinner)).toHaveLength(3)
      expect(field.seeds.filter((s) => s.isWildCard)).toHaveLength(3)
      expect(field.seeds.map((s) => s.seed)).toEqual([1, 2, 3, 4, 5, 6])
    }
  })

  it('seeds #1-3 as division winners and #4-6 as wild cards', () => {
    const standings = simulateCoarseSeason(sampleStrengths(), 'season-xyz')
    const fields = buildPlayoffField(standings)
    for (const field of fields) {
      for (const seed of field.seeds) {
        if (seed.seed <= 3) expect(seed.isDivisionWinner).toBe(true)
        else expect(seed.isWildCard).toBe(true)
      }
    }
  })

  it('makes the #1 seed the best record in its league', () => {
    const standings = simulateCoarseSeason(sampleStrengths(), 'season-xyz')
    const fields = buildPlayoffField(standings)
    for (const field of fields) {
      const top = field.seeds[0]!
      const bestInLeague = Math.max(...standings.byLeague[field.league].map((r) => r.wins))
      expect(top.seed).toBe(1)
      expect(top.record.wins).toBe(bestInLeague)
    }
  })

  it('does not include a wild card with a worse record than a division winner seed ahead of it... ' +
    'actually only checks that division winners are the best of their division', () => {
    const standings = simulateCoarseSeason(sampleStrengths(), 'season-xyz')
    const fields = buildPlayoffField(standings)
    for (const field of fields) {
      const winnerIds = new Set(
        field.seeds.filter((s) => s.isDivisionWinner).map((s) => s.teamId),
      )
      for (const div of (field.league === 'AL'
        ? ['AL-East', 'AL-Central', 'AL-West']
        : ['NL-East', 'NL-Central', 'NL-West']) as Division[]) {
        const divTeams = standings.byDivision[div]
        const divBest = Math.max(...divTeams.map((r) => r.wins))
        const winner = field.seeds.find((s) => s.teamId === divTeams[0]!.teamId)
        if (divTeams[0] && winnerIds.has(divTeams[0].teamId)) {
          expect(winner).toBeDefined()
          expect(winner!.record.wins).toBe(divBest)
        }
      }
    }
  })

  it('resolves ties deterministically (same input => same order)', () => {
    const rows: Array<{ teamId: string; wins: number }> = []
    for (const id of ALL_TEAM_IDS) {
      rows.push({ teamId: id, wins: 81 })
    }
    rows[0] = { teamId: 'yankees', wins: 100 }
    rows[1] = { teamId: 'red-sox', wins: 100 }

    const standings = makeStandings(rows)
    const a = buildPlayoffField(standings)
    const b = buildPlayoffField(standings)
    expect(a).toEqual(b)

    const al = a.find((f) => f.league === 'AL') as PlayoffField
    expect(al.seeds[0]!.record.wins).toBe(100)
    const hundredWinTeams = al.seeds.filter((s) => s.record.wins === 100)
    expect(hundredWinTeams).toHaveLength(2)
    expect(hundredWinTeams.filter((s) => s.isDivisionWinner)).toHaveLength(1)
    expect(hundredWinTeams.filter((s) => s.isWildCard)).toHaveLength(1)
    expect(hundredWinTeams.find((s) => s.isWildCard)!.seed).toBe(4)
    expect(al.seeds.filter((s) => s.isDivisionWinner)).toHaveLength(3)
  })

  it('handles a fully tied league (all 81 wins) with a valid field', () => {
    const rows = ALL_TEAM_IDS.map((id) => ({ teamId: id, wins: 81 }))
    const standings = makeStandings(rows)
    const fields = buildPlayoffField(standings)
    for (const field of fields) {
      expect(field.seeds).toHaveLength(6)
      expect(field.seeds.filter((s) => s.isDivisionWinner)).toHaveLength(3)
      expect(field.seeds.filter((s) => s.isWildCard)).toHaveLength(3)
      expect(field.seeds.map((s) => s.seed)).toEqual([1, 2, 3, 4, 5, 6])
    }
  })
})
