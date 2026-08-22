import type {
  DailyMatchupSnapshot,
  LivePlayer,
  OpponentRoster,
} from '../../../shared/live/live-types'
import type { DailyLineupPosition } from '../../../shared/live/daily-roster'
import {
  mapRawPlayersToLive,
  selectHighestScoringTeam,
  type RawPlayerInput,
} from '../../../shared/live/live-mlb-mapper'
import {
  fetchBoxscore,
  fetchSchedule,
  fetchSeasonStatsBatched,
  getCachedSeasonStats,
  mapWithConcurrency,
  seasonFromDate,
  type BoxTeam,
  type MlbScheduleGame,
  type SeasonStatsCache,
} from './mlb-client'
import { mapPosition, parseHitterStats, parsePitcherStats } from './mlb-parsers'
import { buildRawFromRoster, ROSTER_CONCURRENCY } from './player-pool'
import {
  dailyMatchupSnapshotSeed,
  unavailableDailySnapshotSeed,
  erroredDailySnapshotSeed,
} from '../../../shared/live/seeds'

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

async function buildOpponentRawFromBox(
  opponentSide: BoxTeam,
  topTeam: { teamId: number; teamAbbrev: string; teamName: string },
  season: number,
  statsCache: Map<string, Awaited<ReturnType<typeof import('./mlb-client').fetchSeasonStats>>>,
): Promise<RawPlayerInput[]> {
  const ids = [
    ...(opponentSide.batters ?? []),
    ...(opponentSide.pitchers ?? []),
  ]
  await fetchSeasonStatsBatched(ids, season, statsCache)

  const opponentRaw: RawPlayerInput[] = []
  for (const id of opponentSide.batters ?? []) {
    const entry = opponentSide.players[`ID${id}`]
    if (!entry) continue
    const { hitterSplit, pitcherSplit } = getCachedSeasonStats(id, season, statsCache)
    const isPitcher = entry.position.abbreviation === 'P'
    opponentRaw.push({
      personId: id,
      name: entry.person.fullName,
      teamId: topTeam.teamId,
      teamAbbrev: topTeam.teamAbbrev,
      teamName: topTeam.teamName,
      positions: mapPosition(entry.position.code),
      role: isPitcher ? 'pitcher' : 'hitter',
      hitterStats: parseHitterStats(hitterSplit) ?? undefined,
      pitcherStats: parsePitcherStats(pitcherSplit) ?? undefined,
      appearedOnTargetDate: true,
      isFallback: false,
    })
  }
  for (const id of opponentSide.pitchers ?? []) {
    if (opponentRaw.some((p) => p.personId === id)) continue
    const entry = opponentSide.players[`ID${id}`]
    if (!entry) continue
    const { pitcherSplit } = getCachedSeasonStats(id, season, statsCache)
    opponentRaw.push({
      personId: id,
      name: entry.person.fullName,
      teamId: topTeam.teamId,
      teamAbbrev: topTeam.teamAbbrev,
      teamName: topTeam.teamName,
      positions: ['P'],
      role: 'pitcher',
      pitcherStats: parsePitcherStats(pitcherSplit) ?? undefined,
      appearedOnTargetDate: true,
      isFallback: false,
    })
  }
  return opponentRaw
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
      simSeed: unavailableDailySnapshotSeed(challengeDate),
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
  const boxscoreByGame = new Map<number, Awaited<ReturnType<typeof fetchBoxscore>>>()

  for (const game of games) {
    const box = await fetchBoxscore(game.gamePk)
    boxscoreByGame.set(game.gamePk, box)
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
      simSeed: erroredDailySnapshotSeed(challengeDate),
    }
  }

  const playedTeamIds = [...new Set(teamScores.map((t) => t.teamId))]
  const statsCache: SeasonStatsCache = new Map()
  const rawPlayers: RawPlayerInput[] = []

  const rosterChunks = await mapWithConcurrency(
    playedTeamIds,
    ROSTER_CONCURRENCY,
    async (teamId) => {
      const sample = teamScores.find((t) => t.teamId === teamId)!
      return buildRawFromRoster({
        teamId,
        teamAbbrev: sample.teamAbbrev,
        teamName: sample.teamName,
        season,
        statsCache,
        appearedIds: appearedByTeam.get(teamId),
      })
    },
  )
  rawPlayers.push(...rosterChunks.flat())

  let livePlayers = mapRawPlayersToLive(rawPlayers).filter(
    (p) => p.teamId !== topTeam.teamId,
  )

  const uniqueTeams = new Set(livePlayers.map((p) => p.teamId))
  const minTeamsNeeded = 12
  if (uniqueTeams.size < minTeamsNeeded) {
    const fallbackChunks = await mapWithConcurrency(
      playedTeamIds.filter((id) => id !== topTeam.teamId),
      ROSTER_CONCURRENCY,
      async (teamId) => {
        const sample = teamScores.find((t) => t.teamId === teamId)!
        return buildRawFromRoster({
          teamId,
          teamAbbrev: sample.teamAbbrev,
          teamName: sample.teamName,
          season,
          statsCache,
          appearedIds: appearedByTeam.get(teamId),
          isFallback: true,
        })
      },
    )
    rawPlayers.push(...fallbackChunks.flat())
    livePlayers = mapRawPlayersToLive(rawPlayers).filter(
      (p) => p.teamId !== topTeam.teamId,
    )
  }

  const opponentBox = boxscoreByGame.get(topTeam.gamePk)!
  const opponentSide = topTeam.isHome
    ? opponentBox.teams.home
    : opponentBox.teams.away

  const opponentRaw = await buildOpponentRawFromBox(
    opponentSide,
    topTeam,
    season,
    statsCache,
  )
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
    simSeed: dailyMatchupSnapshotSeed(challengeDate, targetDate, topTeam.teamId),
  }
}

export type { MlbScheduleGame }
