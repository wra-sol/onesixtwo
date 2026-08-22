import { describe, expect, it } from 'vitest'
import {
  buildSim162Season,
  type PostseasonResult,
  type Sim162SeasonResult,
} from './sim162-season'
import {
  autoFillRemaining,
  createSim162DraftState,
} from './sim162-draft'
import {
  createEmptyRoster25,
  roster25BattingOrder,
  roster25Rotation,
  type Roster25,
} from './roster25'
import { LEAGUE_SCHEDULE_LENGTH } from './league-standings'
import type {
  LivePlayer,
  LivePlayerGrades,
  LivePlayerPosition,
  PitcherRoleSlot,
} from './live-types'
import type { Sim162Snapshot } from './sim162-snapshot'

let personCounter = 100000

function nextPersonId(): number {
  personCounter += 1
  return personCounter
}

function makeHitter(
  teamId: number,
  abbrev: string,
  teamName: string,
  pos: LivePlayerPosition,
  overall: number,
  idSuffix: string,
): LivePlayer {
  const grades: LivePlayerGrades = {
    contact: overall,
    power: overall,
    speed: overall,
    defense: overall,
    overall,
  }
  return {
    id: `p-${teamId}-${idSuffix}`,
    personId: nextPersonId(),
    name: `${abbrev} ${idSuffix}`,
    teamId,
    teamAbbrev: abbrev,
    teamName,
    positions: [pos],
    role: 'hitter',
    batSide: 'R',
    grades,
    appearedOnTargetDate: true,
    isFallback: false,
  }
}

function makePitcher(
  teamId: number,
  abbrev: string,
  teamName: string,
  roles: PitcherRoleSlot[],
  overall: number,
  idSuffix: string,
): LivePlayer {
  const grades: LivePlayerGrades = {
    stuff: overall,
    command: overall,
    stamina: overall,
    defense: overall,
    overall,
  }
  return {
    id: `p-${teamId}-${idSuffix}`,
    personId: nextPersonId(),
    name: `${abbrev} ${idSuffix}`,
    teamId,
    teamAbbrev: abbrev,
    teamName,
    positions: ['SP'],
    role: 'pitcher',
    pitchHand: 'R',
    grades,
    appearedOnTargetDate: true,
    isFallback: false,
    pitcherRoles: roles,
  }
}

function buildFullPool(
  teamCount = 30,
  baseOverall = 50,
  spread = 0.5,
): LivePlayer[] {
  const players: LivePlayer[] = []
  for (let t = 0; t < teamCount; t += 1) {
    const teamId = 200 + t
    const abbrev = `T${t}`
    const teamName = `Team ${t}`
    const overall = baseOverall + t * spread
    players.push(makeHitter(teamId, abbrev, teamName, 'C', overall, 'C1'))
    players.push(makeHitter(teamId, abbrev, teamName, 'C', overall, 'C2'))
    players.push(makeHitter(teamId, abbrev, teamName, '1B', overall, '1B'))
    players.push(makeHitter(teamId, abbrev, teamName, '2B', overall, '2B'))
    players.push(makeHitter(teamId, abbrev, teamName, '3B', overall, '3B'))
    players.push(makeHitter(teamId, abbrev, teamName, 'SS', overall, 'SS'))
    players.push(makeHitter(teamId, abbrev, teamName, 'LF', overall, 'LF'))
    players.push(makeHitter(teamId, abbrev, teamName, 'CF', overall, 'CF'))
    players.push(makeHitter(teamId, abbrev, teamName, 'RF', overall, 'RF'))
    players.push(makeHitter(teamId, abbrev, teamName, 'DH', overall, 'DH'))
    players.push(makeHitter(teamId, abbrev, teamName, '1B', overall, 'B1'))
    players.push(makeHitter(teamId, abbrev, teamName, '2B', overall, 'B2'))
    players.push(makeHitter(teamId, abbrev, teamName, '3B', overall, 'B3'))
    players.push(makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP1'))
    players.push(makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP2'))
    players.push(makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP3'))
    players.push(makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP4'))
    players.push(makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP5'))
    players.push(makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP1'))
    players.push(makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP2'))
    players.push(makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP3'))
    players.push(makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP4'))
    players.push(makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP5'))
    players.push(makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP6'))
    players.push(makePitcher(teamId, abbrev, teamName, ['CL'], overall, 'CL'))
  }
  return players
}

function snapshotFromPool(
  pool: LivePlayer[],
  simSeed = 'test-seed',
): Sim162Snapshot {
  return { kind: 'sim162-legends', players: pool, simSeed }
}

function buildSyntheticRoster(overall: number, prefix: string): Roster25 {
  const roster = createEmptyRoster25()
  const teamId = 900
  const abbrev = prefix
  const teamName = `${prefix} User`
  roster.C1 = makeHitter(teamId, abbrev, teamName, 'C', overall, 'C1')
  roster.C2 = makeHitter(teamId, abbrev, teamName, 'C', overall, 'C2')
  roster['1B'] = makeHitter(teamId, abbrev, teamName, '1B', overall, '1B')
  roster['2B'] = makeHitter(teamId, abbrev, teamName, '2B', overall, '2B')
  roster['3B'] = makeHitter(teamId, abbrev, teamName, '3B', overall, '3B')
  roster.SS = makeHitter(teamId, abbrev, teamName, 'SS', overall, 'SS')
  roster.LF = makeHitter(teamId, abbrev, teamName, 'LF', overall, 'LF')
  roster.CF = makeHitter(teamId, abbrev, teamName, 'CF', overall, 'CF')
  roster.RF = makeHitter(teamId, abbrev, teamName, 'RF', overall, 'RF')
  roster.DH = makeHitter(teamId, abbrev, teamName, 'DH', overall, 'DH')
  roster.BENCH1 = makeHitter(teamId, abbrev, teamName, '1B', overall, 'BN1')
  roster.BENCH2 = makeHitter(teamId, abbrev, teamName, '2B', overall, 'BN2')
  roster.BENCH3 = makeHitter(teamId, abbrev, teamName, '3B', overall, 'BN3')
  roster.SP1 = makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP1')
  roster.SP2 = makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP2')
  roster.SP3 = makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP3')
  roster.SP4 = makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP4')
  roster.SP5 = makePitcher(teamId, abbrev, teamName, ['SP'], overall, 'SP5')
  roster.RP1 = makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP1')
  roster.RP2 = makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP2')
  roster.RP3 = makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP3')
  roster.RP4 = makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP4')
  roster.RP5 = makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP5')
  roster.RP6 = makePitcher(teamId, abbrev, teamName, ['RP'], overall, 'RP6')
  roster.CL = makePitcher(teamId, abbrev, teamName, ['CL'], overall, 'CL')
  return roster
}

function seasonFromRoster(
  roster: Roster25,
  pool: LivePlayer[],
  seed: string,
): Sim162SeasonResult {
  return buildSim162Season(
    roster,
    roster25BattingOrder(roster),
    roster25Rotation(roster),
    snapshotFromPool(pool),
    seed,
  )
}

function draftedSeason(
  pool: LivePlayer[],
  seed: string,
): Sim162SeasonResult {
  let draft = createSim162DraftState(pool)
  draft = autoFillRemaining(draft)
  return buildSim162Season(
    draft.roster,
    roster25BattingOrder(draft.roster),
    roster25Rotation(draft.roster),
    snapshotFromPool(pool),
    seed,
  )
}

describe('buildSim162Season — regular season games', () => {
  it('produces exactly 162 PA-sim games for the user', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    expect(result.userGames).toHaveLength(162)
  })

  it('user record wins + losses equals 162', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    expect(result.userRecord.wins + result.userRecord.losses).toBe(162)
    expect(result.userRecord.wins).toBeGreaterThanOrEqual(0)
    expect(result.userRecord.losses).toBeGreaterThanOrEqual(0)
  })

  it('every user game has a valid box score and a decisive score', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    for (const game of result.userGames) {
      expect(game.homeBox.runs).toBe(game.homeScore)
      expect(game.awayBox.runs).toBe(game.awayScore)
      expect(game.events.length).toBeGreaterThan(0)
    }
  })
})

describe('buildSim162Season — standings', () => {
  it('all 30 teams have a 162-game record', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    expect(result.standings.records).toHaveLength(30)
    for (const r of result.standings.records) {
      expect(r.wins + r.losses).toBe(LEAGUE_SCHEDULE_LENGTH)
      expect(r.wins).toBeGreaterThanOrEqual(0)
      expect(r.wins).toBeLessThanOrEqual(LEAGUE_SCHEDULE_LENGTH)
    }
  })

  it('user record in standings matches the PA-sim record', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    const userSlot = result.standings.records.find(
      (r) => r.teamId === result.playoffBracket.userTeamId,
    )
    expect(userSlot).toBeDefined()
    expect(userSlot!.wins).toBe(result.userRecord.wins)
    expect(userSlot!.losses).toBe(result.userRecord.losses)
  })

  it('each division has 5 sorted teams and each league has 15', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    for (const div of Object.keys(result.standings.byDivision)) {
      const teams = result.standings.byDivision[div as keyof typeof result.standings.byDivision]
      expect(teams).toHaveLength(5)
      for (let i = 1; i < teams.length; i += 1) {
        expect(teams[i]!.wins).toBeLessThanOrEqual(teams[i - 1]!.wins)
      }
    }
    expect(result.standings.byLeague.AL).toHaveLength(15)
    expect(result.standings.byLeague.NL).toHaveLength(15)
  })
})

describe('buildSim162Season — playoff field', () => {
  it('produces a 12-team field (6 per league, 3 div winners + 3 WC)', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    expect(result.playoffField).toHaveLength(2)
    for (const field of result.playoffField) {
      expect(field.seeds).toHaveLength(6)
      expect(field.seeds.filter((s) => s.isDivisionWinner)).toHaveLength(3)
      expect(field.seeds.filter((s) => s.isWildCard)).toHaveLength(3)
      expect(field.seeds.map((s) => s.seed)).toEqual([1, 2, 3, 4, 5, 6])
    }
  })

  it('userPlayoffSeed is 1-6 when qualified and null when not', () => {
    const strong = seasonFromRoster(buildSyntheticRoster(78, 'STR'), buildFullPool(30, 50, 0.5), 'seed-q')
    if (strong.userQualified) {
      expect(strong.userPlayoffSeed).toBeGreaterThanOrEqual(1)
      expect(strong.userPlayoffSeed).toBeLessThanOrEqual(6)
    }
    const weak = seasonFromRoster(buildSyntheticRoster(20, 'WK'), buildFullPool(30, 80, 0.2), 'seed-nq')
    expect(weak.userQualified).toBe(false)
    expect(weak.userPlayoffSeed).toBeNull()
  })
})

describe('buildSim162Season — qualifying user (strong roster vs mediocre pool)', () => {
  const roster = buildSyntheticRoster(78, 'STR')
  const pool = buildFullPool(30, 50, 0.5)

  it('qualifies for the playoffs', () => {
    const result = seasonFromRoster(roster, pool, 'qualify-seed')
    expect(result.userQualified).toBe(true)
  })

  it('PA-sims the user playoff series and reports a boolean world series result', () => {
    const result = seasonFromRoster(roster, pool, 'qualify-seed')
    expect(result.userPlayoffSeries.length).toBeGreaterThan(0)
    for (const series of result.userPlayoffSeries) {
      expect(series.games.length).toBeGreaterThanOrEqual(1)
      expect(series.userWins + series.opponentWins).toBeGreaterThanOrEqual(
        Math.min(series.games.length, 4),
      )
    }
    expect(typeof result.wonWorldSeries).toBe('boolean')
    expect(result.postseasonResult).not.toBe('missed')
  })

  it('builds a full 4-round bracket with the expected series counts', () => {
    const result = seasonFromRoster(roster, pool, 'qualify-seed')
    const names = result.playoffBracket.rounds.map((r) => r.name)
    expect(names).toEqual([
      'Wild Card',
      'Division Series',
      'League Championship',
      'World Series',
    ])
    expect(result.playoffBracket.rounds[0]!.series).toHaveLength(4)
    expect(result.playoffBracket.rounds[1]!.series).toHaveLength(4)
    expect(result.playoffBracket.rounds[2]!.series).toHaveLength(2)
    expect(result.playoffBracket.rounds[3]!.series).toHaveLength(1)
  })

  it('every series has a winner drawn from its two teams', () => {
    const result = seasonFromRoster(roster, pool, 'qualify-seed')
    for (const round of result.playoffBracket.rounds) {
      for (const s of round.series) {
        expect([s.homeTeamId, s.awayTeamId]).toContain(s.winnerTeamId)
        expect(s.homeWins + s.awayWins).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('marks exactly the user-involved series as isUserSeries; every series carries PA-sim games', () => {
    const result = seasonFromRoster(roster, pool, 'qualify-seed')
    const allSeries = result.playoffBracket.rounds.flatMap((r) => r.series)
    const userSeries = allSeries.filter((s) => s.isUserSeries)
    expect(userSeries.length).toBe(result.userPlayoffSeries.length)
    expect(userSeries.length).toBeGreaterThan(0)
    for (const s of userSeries) {
      expect(s.games!.length).toBeGreaterThan(0)
    }
    // All-PA seasons: non-user playoff series are fully simulated too.
    const nonUser = allSeries.filter((s) => !s.isUserSeries)
    for (const s of nonUser) {
      expect(s.games).toBeDefined()
      expect(s.games!.length).toBeGreaterThan(0)
    }
  })

  it('reports a valid postseason result when qualified', () => {
    const result = seasonFromRoster(roster, pool, 'qualify-seed')
    const valid: PostseasonResult[] = [
      'wc', 'ds', 'lcs', 'ws-runner-up', 'ws-champs',
    ]
    expect(valid).toContain(result.postseasonResult)
    expect(result.wonWorldSeries).toBe(result.postseasonResult === 'ws-champs')
  })
})

describe('buildSim162Season — non-qualifying user (weak roster vs elite pool)', () => {
  const roster = buildSyntheticRoster(20, 'WK')
  const pool = buildFullPool(30, 80, 0.2)

  it('does not qualify and reports missed postseason', () => {
    const result = seasonFromRoster(roster, pool, 'noqualify-seed')
    expect(result.userQualified).toBe(false)
    expect(result.postseasonResult).toBe('missed')
    expect(result.wonWorldSeries).toBe(false)
    expect(result.userPlayoffSeries).toEqual([])
  })

  it('still builds a full bracket without any user series', () => {
    const result = seasonFromRoster(roster, pool, 'noqualify-seed')
    expect(result.playoffBracket.rounds).toHaveLength(4)
    const userSeries = result.playoffBracket.rounds
      .flatMap((r) => r.series)
      .filter((s) => s.isUserSeries)
    expect(userSeries).toHaveLength(0)
    expect(result.playoffBracket.rounds[3]!.series).toHaveLength(1)
  })
})

describe('buildSim162Season — marquee games', () => {
  it('returns 1-3 marquee games with indices in 0..161', () => {
    const result = draftedSeason(buildFullPool(), 'season-1')
    expect(result.marqueeGames.length).toBeGreaterThanOrEqual(1)
    expect(result.marqueeGames.length).toBeLessThanOrEqual(3)
    const indices = new Set<number>()
    for (const m of result.marqueeGames) {
      expect(m.gameIndex).toBeGreaterThanOrEqual(0)
      expect(m.gameIndex).toBeLessThan(162)
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.game).toBe(result.userGames[m.gameIndex])
      indices.add(m.gameIndex)
    }
    expect(indices.size).toBe(result.marqueeGames.length)
  })

  it('is deterministic for a given seed', () => {
    const pool = buildFullPool()
    const a = draftedSeason(pool, 'season-1')
    const b = draftedSeason(pool, 'season-1')
    expect(a.marqueeGames.map((m) => ({ i: m.gameIndex, l: m.label }))).toEqual(
      b.marqueeGames.map((m) => ({ i: m.gameIndex, l: m.label })),
    )
  })
})

describe('buildSim162Season — determinism', () => {
  it('same roster + seed produces an identical Sim162SeasonResult', () => {
    const pool = buildFullPool()
    const a = draftedSeason(pool, 'determ-seed')
    const b = draftedSeason(pool, 'determ-seed')
    expect(a).toEqual(b)
  })

  it('different seeds can produce different seasons', () => {
    const pool = buildFullPool()
    const a = draftedSeason(pool, 'determ-seed-A')
    const b = draftedSeason(pool, 'determ-seed-B')
    expect(a.userGames).not.toEqual(b.userGames)
  })
})

describe('buildSim162Season — performance', () => {
  it('runs a full season in under 2 seconds', () => {
    const pool = buildFullPool()
    const roster = buildSyntheticRoster(78, 'STR')
    const start = performance.now()
    seasonFromRoster(roster, pool, 'perf-seed')
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(2000)
  })
})
