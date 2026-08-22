import { createSeededRandomFromString } from './rng'
import {
  buildLeagueStrengths,
  buildPlayoffField,
  generateSchedule,
  simulateCoarseSeason,
  teamDivision,
  teamLeague,
  type Division,
  type League,
  type PlayoffField,
  type Standings,
  type TeamRecord,
} from './league-standings'
import { simulateGameRoster, type RosterSimTeam } from './pa-sim'
import { playSeries, coinFlipTieWinner } from './series-sim'
import {
  regularSeasonGameSeed,
  rosterSeriesGameSeed,
} from './seeds'
import {
  buildOpponentRoster25SimTeam,
  buildRoster25SimTeam,
} from './sim162-team'
import { filterSim162PlayersByTeam, type Sim162Snapshot } from './sim162-snapshot'
import { type TeamStaffState, createStaffState } from './staff-state'
import type { Roster25 } from './roster25'
import type {
  LivePlayer,
  SimulatedGame,
  SimulatedSeries,
} from './live-types'

export type PostseasonResult =
  | 'missed'
  | 'wc'
  | 'ds'
  | 'lcs'
  | 'ws-runner-up'
  | 'ws-champs'

export type MarqueeGame = {
  gameIndex: number
  label: string
  game: SimulatedGame
}

export type PlayoffSeries = {
  awaySeed: number
  homeSeed: number
  awayTeamId: string
  homeTeamId: string
  awayWins: number
  homeWins: number
  winnerTeamId: string
  isUserSeries: boolean
  games?: SimulatedGame[]
}

export type PlayoffRound = {
  name: 'Wild Card' | 'Division Series' | 'League Championship' | 'World Series'
  series: PlayoffSeries[]
}

export type PlayoffBracket = {
  rounds: PlayoffRound[]
  userTeamId: string
  userLeague: League
}

export type Sim162SeasonResult = {
  userRecord: { wins: number; losses: number }
  userGames: SimulatedGame[]
  standings: Standings
  playoffField: PlayoffField[]
  userQualified: boolean
  userPlayoffSeed: number | null
  playoffBracket: PlayoffBracket
  userPlayoffSeries: SimulatedSeries[]
  wonWorldSeries: boolean
  postseasonResult: PostseasonResult
  marqueeGames: MarqueeGame[]
  seasonSeed: string
}

export function buildSim162Season(
  roster: Roster25,
  battingOrder: LivePlayer[],
  rotationOrder: LivePlayer[],
  snapshot: Sim162Snapshot,
  seasonSeed: string,
): Sim162SeasonResult {
  const pool = snapshot.players
  const leagueTeams = buildLeagueStrengths({})
  const divisions: Division[] = [...new Set(leagueTeams.map((t) => t.division))]
  const franchiseName = new Map(leagueTeams.map((t) => [t.teamId, t.teamName]))

  const poolTeamIds = [...new Set(pool.map((p) => p.teamId))].sort((a, b) => a - b)
  const franchiseByPoolTeamId = new Map<number, string>()
  const poolTeamIdByFranchise = new Map<string, number>()
  poolTeamIds.forEach((pid, i) => {
    const fid = leagueTeams[i]?.teamId
    if (fid) {
      franchiseByPoolTeamId.set(pid, fid)
      poolTeamIdByFranchise.set(fid, pid)
    }
  })

  const userTeam = buildRoster25SimTeam(roster, {
    name: 'You',
    battingOrder,
    rotationOrder,
  })

  const aceTeamId = userTeam.rotation[0]?.teamId
  const aceFranchise =
    aceTeamId != null ? franchiseByPoolTeamId.get(aceTeamId) : undefined
  const userFranchise = aceFranchise ?? leagueTeams[0]!.teamId
  const userLeague = teamLeague(userFranchise)

  const opponentCache = new Map<string, RosterSimTeam>()
  const staffByFranchise = new Map<string, TeamStaffState>()
  staffByFranchise.set('user', createStaffState())
  const getOpponent = (franchiseId: string): RosterSimTeam => {
    const cached = opponentCache.get(franchiseId)
    if (cached) return cached
    const built = buildOpponentRoster25SimTeam(
      franchiseId,
      franchiseName.get(franchiseId) ?? franchiseId,
      pool,
      poolTeamIdByFranchise.get(franchiseId) ?? null,
    )
    opponentCache.set(franchiseId, built)
    return built
  }
  // Staff states persist across the whole season including the playoff
  // bracket: a bullpen that was worked hard in game 162 is tired in the
  // Wild Card round.
  const staffFor = (franchiseId: string): TeamStaffState => {
    let s = staffByFranchise.get(franchiseId)
    if (!s) {
      s = createStaffState()
      staffByFranchise.set(franchiseId, s)
    }
    return s
  }

  const strengthByTeamId: Record<string, number> = {}
  for (const t of leagueTeams) strengthByTeamId[t.teamId] = 50
  const userRosterPlayers = [
    ...userTeam.battingOrder,
    ...userTeam.bench,
    ...userTeam.rotation,
    ...userTeam.bullpen,
  ]
  strengthByTeamId[userFranchise] = avgOverall(userRosterPlayers)
  for (const t of leagueTeams) {
    if (t.teamId === userFranchise) continue
    const pid = poolTeamIdByFranchise.get(t.teamId)
    if (pid == null) {
      strengthByTeamId[t.teamId] = 50
      continue
    }
    const players = filterSim162PlayersByTeam(pool, pid)
    strengthByTeamId[t.teamId] = players.length ? avgOverall(players) : 50
  }

  const schedule = generateSchedule(seasonSeed)
  const userSchedule = schedule
    .filter((g) => g.home === userFranchise || g.away === userFranchise)
    .sort((a, b) => a.gameIndex - b.gameIndex)

  const userGames: SimulatedGame[] = []
  let wins = 0
  let losses = 0
  userSchedule.forEach((g, idx) => {
    const oppFranchise = g.home === userFranchise ? g.away : g.home
    const userIsHome = g.home === userFranchise
    const oppTeam = getOpponent(oppFranchise)
    const game = simulateGameRoster(
      userTeam,
      oppTeam,
      regularSeasonGameSeed(seasonSeed, idx),
      userIsHome,
      idx,
      { user: staffFor('user'), opponent: staffFor(oppFranchise) },
    )
    userGames.push(game)
    const userScore = userIsHome ? game.homeScore : game.awayScore
    const oppScore = userIsHome ? game.awayScore : game.homeScore
    if (userScore > oppScore) wins += 1
    else if (oppScore > userScore) losses += 1
    else if (coinFlipTieWinner(seasonSeed, idx)) wins += 1
    else losses += 1
  })

  const strengths = buildLeagueStrengths(strengthByTeamId)
  const coarse = simulateCoarseSeason(strengths, seasonSeed)
  const standings = mergeStandings(coarse, userFranchise, wins, losses, divisions)

  const playoffFields = buildPlayoffField(standings)
  const userField = playoffFields.find((f) => f.league === userLeague)!
  const userSeedEntry =
    userField.seeds.find((s) => s.teamId === userFranchise) ?? null
  const userQualified = userSeedEntry !== null
  const userPlayoffSeed = userSeedEntry?.seed ?? null

  const bracketState = buildBracket(
    playoffFields,
    standings,
    userFranchise,
    userTeam,
    getOpponent,
    strengthByTeamId,
    seasonSeed,
    staffFor,
  )

  const postseasonResult: PostseasonResult = userQualified
    ? bracketState.postseasonResult
    : 'missed'
  const wonWorldSeries = postseasonResult === 'ws-champs'

  const marqueeGames = selectMarqueeGames(userGames, userQualified, seasonSeed)

  return {
    userRecord: { wins, losses },
    userGames,
    standings,
    playoffField: playoffFields,
    userQualified,
    userPlayoffSeed,
    playoffBracket: bracketState.bracket,
    userPlayoffSeries: bracketState.userSeries,
    wonWorldSeries,
    postseasonResult,
    marqueeGames,
    seasonSeed,
  }
}

type SeedTeam = { seed: number; teamId: string; strength: number }

function avgOverall(players: LivePlayer[]): number {
  if (players.length === 0) return 50
  return players.reduce((s, p) => s + p.grades.overall, 0) / players.length
}

function mergeStandings(
  coarse: Standings,
  userFranchise: string,
  wins: number,
  losses: number,
  divisions: Division[],
): Standings {
  const orderIndex = new Map(coarse.records.map((r, i) => [r.teamId, i]))
  const cmp = (a: TeamRecord, b: TeamRecord) =>
    b.wins !== a.wins
      ? b.wins - a.wins
      : (orderIndex.get(a.teamId)! - orderIndex.get(b.teamId)!)
  const mergedRecords = coarse.records.map((r) =>
    r.teamId === userFranchise ? { teamId: userFranchise, wins, losses } : r,
  )
  const records = [...mergedRecords].sort(cmp)
  const byDivision = {} as Record<Division, TeamRecord[]>
  for (const div of divisions) {
    byDivision[div] = mergedRecords
      .filter((r) => teamDivision(r.teamId) === div)
      .sort(cmp)
  }
  const byLeague = {
    AL: mergedRecords.filter((r) => teamLeague(r.teamId) === 'AL').sort(cmp),
    NL: mergedRecords.filter((r) => teamLeague(r.teamId) === 'NL').sort(cmp),
  }
  return { records, byDivision, byLeague }
}

function paSimUserSeries(
  userTeam: RosterSimTeam,
  oppTeam: RosterSimTeam,
  bestOf: number,
  seed: string,
  userIsHomeTeam: boolean,
  staffs?: { user: TeamStaffState; opponent: TeamStaffState },
): {
  games: SimulatedGame[]
  series: SimulatedSeries
  winnerIsUser: boolean
} {
  // Sim 162 convention: higher seed (or season-schedule home team) hosts game
  // 0, and tied playoff games are decided by a seeded coin flip so a series
  // always advances someone. Game seed suffix must stay stable — share URLs
  // re-sim from these seeds.
  const series = playSeries({
    bestOf,
    seed,
    userHomeParity: userIsHomeTeam ? 'even' : 'odd',
    tiePolicy: 'coin-flip',
    simulateGame: (i, userIsHome) =>
      simulateGameRoster(
        userTeam,
        oppTeam,
        rosterSeriesGameSeed(seed, i),
        userIsHome,
        i,
        staffs,
      ),
  })
  return { games: series.games, series, winnerIsUser: series.wonSeries }
}

function coarseSeries(
  homeStrength: number,
  awayStrength: number,
  bestOf: number,
  seed: string,
): { homeWins: number; awayWins: number; winner: 'home' | 'away' } {
  const needed = bestOf === 3 ? 2 : bestOf === 5 ? 3 : 4
  const random = createSeededRandomFromString(seed)
  const total = homeStrength + awayStrength
  const probHome = total > 0 ? homeStrength / total : 0.5
  let homeWins = 0
  let awayWins = 0
  for (let i = 0; i < bestOf && homeWins < needed && awayWins < needed; i += 1) {
    if (random() < probHome) homeWins += 1
    else awayWins += 1
  }
  return {
    homeWins,
    awayWins,
    winner: homeWins > awayWins ? 'home' : 'away',
  }
}

function bySeed(seeds: SeedTeam[], seed: number): SeedTeam | undefined {
  return seeds.find((s) => s.seed === seed)
}

function buildBracket(
  playoffFields: PlayoffField[],
  standings: Standings,
  userFranchise: string,
  userTeam: RosterSimTeam,
  getOpponent: (franchiseId: string) => RosterSimTeam,
  strengthByTeamId: Record<string, number>,
  seasonSeed: string,
  staffFor: (franchiseId: string) => TeamStaffState,
): {
  bracket: PlayoffBracket
  userSeries: SimulatedSeries[]
  postseasonResult: PostseasonResult
} {
  const userLeague = teamLeague(userFranchise)
  const rounds: PlayoffRound[] = []
  const userSeries: SimulatedSeries[] = []
  let postseasonResult: PostseasonResult = 'missed'

  const winsByTeam = new Map(standings.records.map((r) => [r.teamId, r.wins]))
  const seedTeamByLeague: Record<League, SeedTeam[]> = { AL: [], NL: [] }
  for (const field of playoffFields) {
    seedTeamByLeague[field.league] = field.seeds.map((s) => ({
      seed: s.seed,
      teamId: s.teamId,
      strength: strengthByTeamId[s.teamId] ?? 50,
    }))
  }

  const playOne = (
    home: SeedTeam,
    away: SeedTeam,
    roundName: PlayoffRound['name'],
    bestOf: number,
    lossLevel: PostseasonResult,
  ): { series: PlayoffSeries; advance: SeedTeam } => {
    const isUserSeries =
      home.teamId === userFranchise || away.teamId === userFranchise
    const seed = `${seasonSeed}|${roundName}|${home.teamId}vs${away.teamId}`
    if (isUserSeries) {
      const opp = home.teamId === userFranchise ? away : home
      const userSeedNum =
        home.teamId === userFranchise ? home.seed : away.seed
      const userIsHomeTeam = home.teamId === userFranchise
      const oppTeam = getOpponent(opp.teamId)
      const { games, series, winnerIsUser } = paSimUserSeries(
        userTeam,
        oppTeam,
        bestOf,
        seed,
        userIsHomeTeam,
        { user: staffFor('user'), opponent: staffFor(opp.teamId) },
      )
      userSeries.push(series)
      const homeWins =
        home.teamId === userFranchise ? series.userWins : series.opponentWins
      const awayWins =
        home.teamId === userFranchise ? series.opponentWins : series.userWins
      const winnerTeamId = winnerIsUser ? userFranchise : opp.teamId
      const ps: PlayoffSeries = {
        awaySeed: away.seed,
        homeSeed: home.seed,
        awayTeamId: away.teamId,
        homeTeamId: home.teamId,
        awayWins,
        homeWins,
        winnerTeamId,
        isUserSeries: true,
        games,
      }
      const advance = winnerIsUser
        ? {
            seed: userSeedNum,
            teamId: userFranchise,
            strength: strengthByTeamId[userFranchise] ?? 50,
          }
        : opp
      if (winnerIsUser && roundName === 'World Series') {
        postseasonResult = 'ws-champs'
      } else if (!winnerIsUser) {
        postseasonResult = lossLevel
      }
      return { series: ps, advance }
    }
    const { homeWins, awayWins, winner } = coarseSeries(
      home.strength,
      away.strength,
      bestOf,
      seed,
    )
    const winnerTeamId = winner === 'home' ? home.teamId : away.teamId
    const advance = winner === 'home' ? home : away
    const ps: PlayoffSeries = {
      awaySeed: away.seed,
      homeSeed: home.seed,
      awayTeamId: away.teamId,
      homeTeamId: home.teamId,
      awayWins,
      homeWins,
      winnerTeamId,
      isUserSeries: false,
    }
    return { series: ps, advance }
  }

  const wcSeries: PlayoffSeries[] = []
  const wcAdvancers: Record<League, SeedTeam[]> = { AL: [], NL: [] }
  for (const league of ['AL', 'NL'] as League[]) {
    const seeds = seedTeamByLeague[league]
    const s3 = bySeed(seeds, 3)!
    const s4 = bySeed(seeds, 4)!
    const s5 = bySeed(seeds, 5)!
    const s6 = bySeed(seeds, 6)!
    const a = playOne(s3, s6, 'Wild Card', 3, 'wc')
    wcSeries.push(a.series)
    const b = playOne(s4, s5, 'Wild Card', 3, 'wc')
    wcSeries.push(b.series)
    wcAdvancers[league] = [a.advance, b.advance]
  }
  rounds.push({ name: 'Wild Card', series: wcSeries })

  const dsSeries: PlayoffSeries[] = []
  const dsAdvancers: Record<League, SeedTeam[]> = { AL: [], NL: [] }
  for (const league of ['AL', 'NL'] as League[]) {
    const seeds = seedTeamByLeague[league]
    const s1 = bySeed(seeds, 1)!
    const s2 = bySeed(seeds, 2)!
    const sorted = [...wcAdvancers[league]].sort((a, b) => b.seed - a.seed)
    const worse = sorted[0]!
    const better = sorted[1]!
    const a = playOne(s1, worse, 'Division Series', 5, 'ds')
    dsSeries.push(a.series)
    const b = playOne(s2, better, 'Division Series', 5, 'ds')
    dsSeries.push(b.series)
    dsAdvancers[league] = [a.advance, b.advance]
  }
  rounds.push({ name: 'Division Series', series: dsSeries })

  const lcsSeries: PlayoffSeries[] = []
  const leagueChamps = {} as Record<League, SeedTeam>
  for (const league of ['AL', 'NL'] as League[]) {
    const [x, y] = dsAdvancers[league]
    const home = x!.seed < y!.seed ? x! : y!
    const away = x!.seed < y!.seed ? y! : x!
    const a = playOne(home, away, 'League Championship', 7, 'lcs')
    lcsSeries.push(a.series)
    leagueChamps[league] = a.advance
  }
  rounds.push({ name: 'League Championship', series: lcsSeries })

  const al = leagueChamps.AL
  const nl = leagueChamps.NL
  const alWins = winsByTeam.get(al.teamId) ?? 0
  const nlWins = winsByTeam.get(nl.teamId) ?? 0
  const wsHome = alWins >= nlWins ? al : nl
  const wsAway = alWins >= nlWins ? nl : al
  const ws = playOne(wsHome, wsAway, 'World Series', 7, 'ws-runner-up')
  rounds.push({ name: 'World Series', series: [ws.series] })

  const bracket: PlayoffBracket = {
    rounds,
    userTeamId: userFranchise,
    userLeague,
  }
  return { bracket, userSeries, postseasonResult }
}

function selectMarqueeGames(
  games: SimulatedGame[],
  userQualified: boolean,
  seasonSeed: string,
): MarqueeGame[] {
  const results = games.map((g, i) => {
    const userScore = g.userWasHome ? g.homeScore : g.awayScore
    const oppScore = g.userWasHome ? g.awayScore : g.homeScore
    let won: boolean
    if (userScore > oppScore) won = true
    else if (oppScore > userScore) won = false
    else won = coinFlipTieWinner(seasonSeed, i)
    return { i, won }
  })

  let bestEnd = -1
  let bestLen = 0
  let curLen = 0
  for (let i = 0; i < results.length; i += 1) {
    if (results[i]!.won) {
      curLen += 1
      if (curLen > bestLen) {
        bestLen = curLen
        bestEnd = i
      }
    } else {
      curLen = 0
    }
  }

  const candidates: Array<{ gameIndex: number; label: string; priority: number }> =
    []

  let lastWin = -1
  for (let i = results.length - 1; i >= 0; i -= 1) {
    if (results[i]!.won) {
      lastWin = i
      break
    }
  }
  if (userQualified && lastWin >= 0) {
    candidates.push({ gameIndex: lastWin, label: 'Clincher', priority: 0 })
  }

  if (bestLen > 0 && bestEnd + 1 < results.length && !results[bestEnd + 1]!.won) {
    candidates.push({
      gameIndex: bestEnd + 1,
      label: 'Streak-breaker',
      priority: 1,
    })
  }

  if (bestLen > 0) {
    candidates.push({ gameIndex: bestEnd, label: 'Hot streak', priority: 2 })
  }

  const byIndex = new Map<
    number,
    { gameIndex: number; label: string; priority: number }
  >()
  for (const c of candidates) {
    const existing = byIndex.get(c.gameIndex)
    if (!existing || c.priority < existing.priority) byIndex.set(c.gameIndex, c)
  }
  const sorted = [...byIndex.values()].sort(
    (a, b) => a.priority - b.priority || a.gameIndex - b.gameIndex,
  )
  let picks = sorted.slice(0, 3)
  if (picks.length === 0) {
    const idx = games.length - 1
    picks = [{ gameIndex: idx, label: 'Season finale', priority: 0 }]
  }
  return picks.map((p) => ({
    gameIndex: p.gameIndex,
    label: p.label,
    game: games[p.gameIndex]!,
  }))
}
