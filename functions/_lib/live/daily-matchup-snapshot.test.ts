import { describe, expect, it } from 'vitest'
import { buildDailyMatchupSnapshot } from './daily-matchup-snapshot'
import type { MlbDataSource } from './mlb-source'
import type {
  BoxTeam,
  MlbRosterResponse,
  MlbScheduleGame,
  SeasonStats,
} from './mlb-client'

const TARGET_DATE = '2026-06-24'

type TeamDef = { id: number; abbrev: string; name: string }

const TEAMS: Record<string, TeamDef> = {
  LAD: { id: 119, abbrev: 'LAD', name: 'Los Angeles Dodgers' },
  NYY: { id: 147, abbrev: 'NYY', name: 'New York Yankees' },
  BOS: { id: 111, abbrev: 'BOS', name: 'Boston Red Sox' },
  NYM: { id: 121, abbrev: 'NYM', name: 'New York Mets' },
}

const HITTER_CODES = ['2', '3', '4', '5', '6', '7', '8', '9', '10']

function hitterStat(): Record<string, unknown> {
  return {
    avg: 0.28,
    obp: 0.35,
    slg: 0.47,
    stolenBases: 5,
    plateAppearances: 200,
  }
}

function pitcherStat(ip = 60): Record<string, unknown> {
  return {
    era: 3.5,
    whip: 1.2,
    strikeOuts: ip,
    baseOnBalls: 20,
    inningsPitched: ip,
    gamesStarted: ip > 40 ? 12 : 0,
    saves: ip <= 40 ? 8 : 0,
    gamesPlayed: 30,
  }
}

function rosterFor(team: TeamDef): MlbRosterResponse {
  const entries = HITTER_CODES.map((code, i) => ({
    person: { id: team.id * 100 + i, fullName: `${team.abbrev} H${i}` },
    position: { abbreviation: code === '10' ? 'DH' : code, code },
  }))
  for (let p = 0; p < 3; p += 1) {
    entries.push({
      person: { id: team.id * 100 + 50 + p, fullName: `${team.abbrev} P${p}` },
      position: { abbreviation: 'P', code: '1' },
    })
  }
  return { roster: entries }
}

function boxTeamFor(team: TeamDef): BoxTeam {
  const players: BoxTeam['players'] = {}
  const batters = HITTER_CODES.map((_, i) => team.id * 100 + i)
  const pitchers = [0, 1, 2].map((p) => team.id * 100 + 50 + p)
  batters.forEach((id, i) => {
    players[`ID${id}`] = {
      person: { id, fullName: `Player ${id}` },
      position: {
        abbreviation: HITTER_CODES[i] === '10' ? 'DH' : HITTER_CODES[i],
        code: HITTER_CODES[i],
      },
    }
  })
  for (const id of pitchers) {
    players[`ID${id}`] = {
      person: { id, fullName: `Player ${id}` },
      position: { abbreviation: 'P', code: '1' },
    }
  }
  return {
    team: { id: team.id, name: team.name, abbreviation: team.abbrev },
    teamStats: { batting: { hits: 10 } },
    players,
    batters,
    pitchers,
  }
}

function scheduleGame(
  gamePk: number,
  away: TeamDef,
  awayScore: number,
  home: TeamDef,
  homeScore: number,
): MlbScheduleGame {
  return {
    gamePk,
    status: { abstractGameState: 'Final' },
    teams: {
      away: { team: { id: away.id, name: away.name }, score: awayScore },
      home: { team: { id: home.id, name: home.name }, score: homeScore },
    },
  }
}

function sourceWith(
  games: MlbScheduleGame[],
  boxes: Map<number, { away: BoxTeam; home: BoxTeam }>,
): MlbDataSource {
  const pitcherIds = new Set<number>()
  for (const box of boxes.values()) {
    for (const side of [box.away, box.home]) {
      for (const id of side.pitchers ?? []) pitcherIds.add(id)
    }
  }
  return {
    schedule: async () => ({ dates: [{ games }] }),
    boxscore: async (gamePk) => ({ teams: boxes.get(gamePk)! }),
    teamRoster: async (teamId) => {
      const team = Object.values(TEAMS).find((t) => t.id === teamId)!
      return rosterFor(team)
    },
    seasonStats: async (personId: number): Promise<SeasonStats> => ({
      hitterSplit: pitcherIds.has(personId) ? undefined : hitterStat(),
      pitcherSplit: pitcherIds.has(personId) ? pitcherStat() : undefined,
    }),
    allTeams: async () => ({ teams: [] }),
    pitchArsenal: async () => null,
  }
}

function twoGameSource(): MlbDataSource {
  const boxes = new Map([
    [
      1001,
      { away: boxTeamFor(TEAMS.LAD), home: boxTeamFor(TEAMS.NYY) },
    ],
    [
      1002,
      { away: boxTeamFor(TEAMS.BOS), home: boxTeamFor(TEAMS.NYM) },
    ],
  ])
  const games = [
    scheduleGame(1001, TEAMS.LAD, 12, TEAMS.NYY, 3),
    scheduleGame(1002, TEAMS.BOS, 5, TEAMS.NYM, 4),
  ]
  return sourceWith(games, boxes)
}

describe('buildDailyMatchupSnapshot', () => {
  it('selects the highest-scoring team as opponent and excludes it from the pool', async () => {
    const snapshot = await buildDailyMatchupSnapshot(
      '2026-06-25',
      TARGET_DATE,
      twoGameSource(),
    )

    expect(snapshot.available).toBe(true)
    expect(snapshot.opponent?.teamId).toBe(119)
    expect(snapshot.opponent?.teamAbbrev).toBe('LAD')
    expect(snapshot.opponentGameScore.runs).toBe(12)
    expect(snapshot.opponent?.battingOrder.length).toBe(9)

    expect(snapshot.players.length).toBeGreaterThan(0)
    expect(snapshot.players.some((p) => p.teamId === 119)).toBe(false)
    // Only three non-opponent teams played → thin pool → fallback refetch ran,
    // so both primary and fallback copies exist for those teams.
    expect(snapshot.players.some((p) => p.isFallback)).toBe(true)
    expect(snapshot.players.some((p) => !p.isFallback)).toBe(true)
  })

  it('fills the opponent lineup from the box score by position', async () => {
    const snapshot = await buildDailyMatchupSnapshot(
      '2026-06-25',
      TARGET_DATE,
      twoGameSource(),
    )
    const lineup = snapshot.opponent!.lineup
    expect(lineup.SP).toBeTruthy()
    expect(lineup.RP).toBeTruthy()
    expect(lineup.CL).toBeTruthy()
    expect(lineup.C).toBeTruthy()
    expect(lineup['1B']).toBeTruthy()
    expect(lineup.DH).toBeTruthy()
  })

  it('returns an unavailable snapshot when no games are final', async () => {
    const source = sourceWith([], new Map())
    const snapshot = await buildDailyMatchupSnapshot('2026-06-25', TARGET_DATE, source)

    expect(snapshot.available).toBe(false)
    expect(snapshot.unavailableReason).toBe('No MLB games yesterday')
    expect(snapshot.players).toEqual([])
    expect(snapshot.simSeed.startsWith('2026-06-25|unavailable')).toBe(true)
  })

  it('derives the season from the target date, not the challenge date', async () => {
    let requestedRosterSeason: number | null = null
    const base = twoGameSource()
    const source: MlbDataSource = {
      ...base,
      teamRoster: async (teamId, season) => {
        requestedRosterSeason = season
        return base.teamRoster(teamId, season)
      },
    }
    await buildDailyMatchupSnapshot('2026-06-25', '2025-08-01', source)
    expect(requestedRosterSeason).toBe(2025)
  })
})
