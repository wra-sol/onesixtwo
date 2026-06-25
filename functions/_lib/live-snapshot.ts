import type {
  DailyMatchupSnapshot,
  LiveDraftSnapshot,
  LivePlayer,
  OpponentRoster,
} from '../src/lib/live-types'
import type { DailyLineupPosition } from '../src/lib/daily-roster'
import {
  mapRawPlayersToLive,
  selectHighestScoringTeam,
  type RawPlayerInput,
} from '../src/lib/live-mlb-mapper'

const MLB_API = 'https://statsapi.mlb.com/api/v1'

export function challengeDateFromNow(now = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

export function targetDateFromNow(now = new Date()): string {
  const eastern = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  )
  eastern.setDate(eastern.getDate() - 1)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(eastern)
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededCoinFlip(seed: string): boolean {
  return hashSeed(`${seed}|coin`) % 2 === 0
}

type MlbScheduleGame = {
  gamePk: number
  status: { abstractGameState: string }
  teams: {
    away: { team: { id: number; name: string; abbreviation?: string }; score?: number }
    home: { team: { id: number; name: string; abbreviation?: string }; score?: number }
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`MLB API error ${response.status}: ${url}`)
  }
  return (await response.json()) as T
}

function mapPosition(code: string): RawPlayerInput['positions'] {
  const map: Record<string, RawPlayerInput['positions'][number]> = {
    '1': 'P',
    '2': 'C',
    '3': '1B',
    '4': '2B',
    '5': '3B',
    '6': 'SS',
    '7': 'LF',
    '8': 'CF',
    '9': 'RF',
    '10': 'DH',
    'O': 'OF',
  }
  const pos = map[code]
  return pos ? [pos] : ['OF']
}

function parseHitterStats(split: Record<string, unknown>): RawPlayerInput['hitterStats'] {
  const avg = Number(split.avg ?? 0)
  const obp = Number(split.obp ?? 0)
  const slg = Number(split.slg ?? 0)
  const ops = Number(split.ops ?? obp + slg)
  return {
    avg,
    obp,
    slg,
    ops,
    sb: Number(split.stolenBases ?? split.sb ?? 0),
    pa: Number(split.plateAppearances ?? split.pa ?? 0),
  }
}

function parsePitcherStats(split: Record<string, unknown>): RawPlayerInput['pitcherStats'] {
  const ip = Number(split.inningsPitched ?? split.ip ?? 0)
  const era = Number(split.era ?? 4.5)
  const whip = Number(split.whip ?? 1.3)
  const k = Number(split.strikeOuts ?? split.so ?? 0)
  const bb = Number(split.baseOnBalls ?? split.bb ?? 0)
  const k9 = ip > 0 ? (k / ip) * 9 : 8
  const bb9 = ip > 0 ? (bb / ip) * 9 : 3.5
  return {
    era,
    whip,
    k9,
    bb9,
    ip,
    gs: Number(split.gamesStarted ?? split.gs ?? 0),
    saves: Number(split.saves ?? 0),
    g: Number(split.gamesPlayed ?? split.g ?? 0),
  }
}

async function fetchSeasonStats(personId: number, season: number) {
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

async function fetchTeamRoster(teamId: number, season: number) {
  return fetchJson<{
    roster: Array<{
      person: { id: number; fullName: string; batSide?: { code: string }; pitchHand?: { code: string } }
      position: { abbreviation: string; code: string }
    }>
  }>(`${MLB_API}/teams/${teamId}/roster?rosterType=active&season=${season}`)
}

async function fetchSchedule(date: string) {
  return fetchJson<{ dates?: Array<{ games?: MlbScheduleGame[] }> }>(
    `${MLB_API}/schedule?sportId=1&date=${date}`,
  )
}

async function fetchBoxscore(gamePk: number) {
  return fetchJson<{
    teams: {
      away: BoxTeam
      home: BoxTeam
    }
  }>(`${MLB_API}/game/${gamePk}/boxscore`)
}

type BoxTeam = {
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

function seasonFromDate(date: string): number {
  const [year, month] = date.split('-').map(Number)
  return month && month >= 3 ? year! : (year ?? new Date().getFullYear()) - 1
}

async function buildRawFromRoster(
  teamId: number,
  teamAbbrev: string,
  teamName: string,
  season: number,
  appearedIds: Set<number>,
  isFallback: boolean,
): Promise<RawPlayerInput[]> {
  const roster = await fetchTeamRoster(teamId, season)
  const results: RawPlayerInput[] = []

  for (const entry of roster.roster) {
    const posAbbrev = entry.position.abbreviation
    const isPitcher = posAbbrev === 'P' || entry.position.code === '1'
    const { hitterSplit, pitcherSplit } = await fetchSeasonStats(entry.person.id, season)
    const pa = Number(hitterSplit?.plateAppearances ?? hitterSplit?.pa ?? 0)
    const ip = Number(pitcherSplit?.inningsPitched ?? pitcherSplit?.ip ?? 0)
    if (!isPitcher && pa < 20 && !appearedIds.has(entry.person.id)) continue
    if (isPitcher && ip < 5 && !appearedIds.has(entry.person.id)) continue

    results.push({
      personId: entry.person.id,
      name: entry.person.fullName,
      teamId,
      teamAbbrev,
      teamName,
      positions: mapPosition(entry.position.code),
      role: isPitcher ? 'pitcher' : 'hitter',
      batSide: entry.person.batSide?.code as 'L' | 'R' | 'S' | undefined,
      pitchHand: entry.person.pitchHand?.code as 'L' | 'R' | undefined,
      hitterStats: hitterSplit ? parseHitterStats(hitterSplit) : undefined,
      pitcherStats: pitcherSplit ? parsePitcherStats(pitcherSplit) : undefined,
      appearedOnTargetDate: appearedIds.has(entry.person.id),
      isFallback,
    })
  }

  return results
}

function buildOpponentRosterFromBox(
  boxTeam: BoxTeam,
  livePlayers: LivePlayer[],
): OpponentRoster {
  const byId = new Map(livePlayers.map((p) => [p.personId, p]))
  const lineup: Partial<Record<DailyLineupPosition, LivePlayer>> = {}
  const battingOrder: LivePlayer[] = []

  const batterIds = boxTeam.batters ?? []
  for (const id of batterIds.slice(0, 9)) {
    const player = byId.get(id)
    if (player) battingOrder.push(player)
  }

  const pitchers = boxTeam.pitchers ?? []
  const pitcherPlayers = pitchers
    .map((id) => byId.get(id))
    .filter((p): p is LivePlayer => Boolean(p))

  if (pitcherPlayers[0]) lineup.SP = pitcherPlayers[0]
  if (pitcherPlayers[1]) lineup.RP = pitcherPlayers[1]
  if (pitcherPlayers[2]) lineup.CL = pitcherPlayers[2] ?? pitcherPlayers[pitcherPlayers.length - 1]
  else if (pitcherPlayers[1]) lineup.CL = pitcherPlayers[1]

  let ofIndex = 0
  const ofSlots: DailyLineupPosition[] = ['OF1', 'OF2', 'OF3']
  for (const batter of battingOrder) {
    const pos = batter.positions[0]
    if (pos === 'C' && !lineup.C) lineup.C = batter
    else if (pos === '1B' && !lineup['1B']) lineup['1B'] = batter
    else if (pos === '2B' && !lineup['2B']) lineup['2B'] = batter
    else if (pos === '3B' && !lineup['3B']) lineup['3B'] = batter
    else if (pos === 'SS' && !lineup.SS) lineup.SS = batter
    else if ((pos === 'LF' || pos === 'CF' || pos === 'RF' || pos === 'OF') && ofIndex < 3) {
      lineup[ofSlots[ofIndex]!] = batter
      ofIndex += 1
    } else if (pos === 'DH' && !lineup.DH) lineup.DH = batter
  }

  return {
    teamId: boxTeam.team.id,
    teamAbbrev: boxTeam.team.abbreviation ?? 'OPP',
    teamName: boxTeam.team.name,
    lineup,
    battingOrder,
  }
}

export async function buildDailyMatchupSnapshot(
  challengeDate: string,
  targetDate: string,
): Promise<DailyMatchupSnapshot> {
  const season = seasonFromDate(targetDate)
  const schedule = await fetchSchedule(targetDate)
  const games =
    schedule.dates?.[0]?.games?.filter(
      (g) => g.status.abstractGameState === 'Final',
    ) ?? []

  if (games.length === 0) {
    return {
      kind: 'daily-matchup',
      challengeDate,
      targetDate,
      available: false,
      unavailableReason: 'No MLB games yesterday',
      opponent: null,
      opponentGameScore: { runs: 0, hits: 0, runDiff: 0 },
      players: [],
      simSeed: `${challengeDate}|unavailable`,
    }
  }

  const teamScores: Array<{
    teamId: number
    teamAbbrev: string
    teamName: string
    runs: number
    hits: number
    opponentRuns: number
    gamePk: number
    isHome: boolean
  }> = []

  const appearedByTeam = new Map<number, Set<number>>()

  for (const game of games) {
    const box = await fetchBoxscore(game.gamePk)
    for (const [side, teamBox] of [
      ['away', box.teams.away] as const,
      ['home', box.teams.home] as const,
    ]) {
      const runs = side === 'away' ? game.teams.away.score ?? 0 : game.teams.home.score ?? 0
      const oppRuns = side === 'away' ? game.teams.home.score ?? 0 : game.teams.away.score ?? 0
      const hits = teamBox.teamStats?.batting?.hits ?? 0
      teamScores.push({
        teamId: teamBox.team.id,
        teamAbbrev: teamBox.team.abbreviation ?? side.toUpperCase(),
        teamName: teamBox.team.name,
        runs,
        hits,
        opponentRuns: oppRuns,
        gamePk: game.gamePk,
        isHome: side === 'home',
      })

      const appeared = new Set<number>()
      for (const id of teamBox.batters ?? []) appeared.add(id)
      for (const id of teamBox.pitchers ?? []) appeared.add(id)
      appearedByTeam.set(teamBox.team.id, appeared)
    }
  }

  const topTeam = selectHighestScoringTeam(teamScores)
  if (!topTeam) {
    return {
      kind: 'daily-matchup',
      challengeDate,
      targetDate,
      available: false,
      unavailableReason: 'Could not determine opponent',
      opponent: null,
      opponentGameScore: { runs: 0, hits: 0, runDiff: 0 },
      players: [],
      simSeed: `${challengeDate}|error`,
    }
  }

  const playedTeamIds = [...new Set(teamScores.map((t) => t.teamId))]
  const rawPlayers: RawPlayerInput[] = []

  for (const teamId of playedTeamIds) {
    const sample = teamScores.find((t) => t.teamId === teamId)!
    const appeared = appearedByTeam.get(teamId) ?? new Set<number>()
    rawPlayers.push(
      ...(await buildRawFromRoster(
        teamId,
        sample.teamAbbrev,
        sample.teamName,
        season,
        appeared,
        false,
      )),
    )
  }

  let livePlayers = mapRawPlayersToLive(rawPlayers).filter(
    (p) => p.teamId !== topTeam.teamId,
  )

  const uniqueTeams = new Set(livePlayers.map((p) => p.teamId))
  const minTeamsNeeded = 12
  if (uniqueTeams.size < minTeamsNeeded) {
    for (const teamId of playedTeamIds) {
      if (teamId === topTeam.teamId) continue
      const sample = teamScores.find((t) => t.teamId === teamId)!
      const appeared = appearedByTeam.get(teamId) ?? new Set<number>()
      rawPlayers.push(
        ...(await buildRawFromRoster(
          teamId,
          sample.teamAbbrev,
          sample.teamName,
          season,
          appeared,
          true,
        )),
      )
    }
    livePlayers = mapRawPlayersToLive(rawPlayers).filter(
      (p) => p.teamId !== topTeam.teamId,
    )
  }

  const opponentGame = games.find((g) => g.gamePk === topTeam.gamePk)!
  const opponentBox = await fetchBoxscore(opponentGame.gamePk)
  const opponentSide = topTeam.isHome ? opponentBox.teams.home : opponentBox.teams.away

  const opponentRaw: RawPlayerInput[] = []
  for (const id of opponentSide.batters ?? []) {
    const entry = opponentSide.players[`ID${id}`]
    if (!entry) continue
    const { hitterSplit, pitcherSplit } = await fetchSeasonStats(id, season)
    opponentRaw.push({
      personId: id,
      name: entry.person.fullName,
      teamId: topTeam.teamId,
      teamAbbrev: topTeam.teamAbbrev,
      teamName: topTeam.teamName,
      positions: mapPosition(entry.position.code),
      role: entry.position.abbreviation === 'P' ? 'pitcher' : 'hitter',
      hitterStats: hitterSplit ? parseHitterStats(hitterSplit) : undefined,
      pitcherStats: pitcherSplit ? parsePitcherStats(pitcherSplit) : undefined,
      appearedOnTargetDate: true,
      isFallback: false,
    })
  }
  for (const id of opponentSide.pitchers ?? []) {
    if (opponentRaw.some((p) => p.personId === id)) continue
    const entry = opponentSide.players[`ID${id}`]
    if (!entry) continue
    const { pitcherSplit } = await fetchSeasonStats(id, season)
    opponentRaw.push({
      personId: id,
      name: entry.person.fullName,
      teamId: topTeam.teamId,
      teamAbbrev: topTeam.teamAbbrev,
      teamName: topTeam.teamName,
      positions: ['P'],
      role: 'pitcher',
      pitcherStats: pitcherSplit ? parsePitcherStats(pitcherSplit) : undefined,
      appearedOnTargetDate: true,
      isFallback: false,
    })
  }

  const opponentPlayers = mapRawPlayersToLive(opponentRaw)
  const opponent = buildOpponentRosterFromBox(opponentSide, opponentPlayers)

  return {
    kind: 'daily-matchup',
    challengeDate,
    targetDate,
    available: true,
    opponent,
    opponentGameScore: {
      runs: topTeam.runs,
      hits: topTeam.hits,
      runDiff: topTeam.runs - topTeam.opponentRuns,
    },
    players: livePlayers,
    simSeed: `${challengeDate}|${targetDate}|${topTeam.teamId}`,
  }
}

export async function buildLiveDraftSnapshot(
  challengeDate: string,
): Promise<LiveDraftSnapshot> {
  const season = seasonFromDate(challengeDate)
  const teams = await fetchJson<{
    teams: Array<{ id: number; abbreviation: string; name: string }>
  }>(`${MLB_API}/teams?sportId=1&season=${season}`)

  const rawPlayers: RawPlayerInput[] = []
  for (const team of teams.teams) {
    rawPlayers.push(
      ...(await buildRawFromRoster(
        team.id,
        team.abbreviation,
        team.name,
        season,
        new Set<number>(),
        false,
      )),
    )
  }

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

export { buildFixtureDailyMatchupSnapshot, buildFixtureLiveDraftSnapshot } from '../../src/lib/live-fixtures'
