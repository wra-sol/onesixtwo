import type { DailyMatchupSnapshot, LiveDraftSnapshot } from './live-types'
import { mapRawPlayersToLive, type RawPlayerInput } from './live-mlb-mapper'
import type { DailyLineupPosition } from './daily-roster'
import { dailyMatchupSnapshotSeed, liveDraftSnapshotSeed } from './seeds'

function sampleHitters(teamId: number, abbrev: string, name: string, baseId: number): RawPlayerInput[] {
  const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const
  const hitters = positions.map((pos, index) => ({
    personId: baseId + index,
    name: `${abbrev} Hitter ${index + 1}`,
    teamId,
    teamAbbrev: abbrev,
    teamName: name,
    positions: [pos === 'LF' || pos === 'CF' || pos === 'RF' ? 'OF' : pos],
    role: 'hitter' as const,
    batSide: index % 2 === 0 ? ('L' as const) : ('R' as const),
    hitterStats: {
      obp: 0.32 + index * 0.01,
      slg: 0.42 + index * 0.015,
      ops: 0.74 + index * 0.025,
      sb: index * 3,
      pa: 200 + index * 10,
    },
    appearedOnTargetDate: true,
    isFallback: false,
  }))

  return [
    ...hitters,
    {
      personId: baseId + 20,
      name: `${abbrev} Backup C`,
      teamId,
      teamAbbrev: abbrev,
      teamName: name,
      positions: ['C'] as const,
      role: 'hitter' as const,
      batSide: 'R' as const,
      hitterStats: {
        obp: 0.28,
        slg: 0.35,
        ops: 0.63,
        sb: 0,
        pa: 80,
      },
      appearedOnTargetDate: true,
      isFallback: false,
    },
  ] as RawPlayerInput[]
}

function samplePitchers(teamId: number, abbrev: string, name: string, baseId: number): RawPlayerInput[] {
  return [
    {
      personId: baseId,
      name: `${abbrev} Starter`,
      teamId,
      teamAbbrev: abbrev,
      teamName: name,
      positions: ['SP'],
      role: 'pitcher',
      pitchHand: 'R',
      pitcherStats: { era: 3.2, whip: 1.1, k9: 9.5, bb9: 2.5, ip: 90, gs: 15, g: 16, saves: 0 },
      appearedOnTargetDate: true,
      isFallback: false,
    },
    {
      personId: baseId + 1,
      name: `${abbrev} Reliever`,
      teamId,
      teamAbbrev: abbrev,
      teamName: name,
      positions: ['SP'],
      role: 'pitcher',
      pitchHand: 'L',
      pitcherStats: { era: 3.8, whip: 1.2, k9: 10, bb9: 3.1, ip: 40, gs: 0, g: 40, saves: 2 },
      appearedOnTargetDate: true,
      isFallback: false,
    },
    {
      personId: baseId + 2,
      name: `${abbrev} Closer`,
      teamId,
      teamAbbrev: abbrev,
      teamName: name,
      positions: ['SP'],
      role: 'pitcher',
      pitchHand: 'R',
      pitcherStats: { era: 2.5, whip: 0.95, k9: 11, bb9: 2.2, ip: 35, gs: 0, g: 35, saves: 18 },
      appearedOnTargetDate: true,
      isFallback: false,
    },
  ]
}

export function buildFixtureDailyMatchupSnapshot(
  challengeDate: string,
  targetDate: string,
): DailyMatchupSnapshot {
  const teams = [
    { id: 119, abbrev: 'LAD', name: 'Los Angeles Dodgers' },
    { id: 147, abbrev: 'NYY', name: 'New York Yankees' },
    { id: 111, abbrev: 'BOS', name: 'Boston Red Sox' },
    { id: 121, abbrev: 'NYM', name: 'New York Mets' },
    { id: 120, abbrev: 'WSH', name: 'Washington Nationals' },
    { id: 110, abbrev: 'BAL', name: 'Baltimore Orioles' },
    { id: 139, abbrev: 'TB', name: 'Tampa Bay Rays' },
    { id: 141, abbrev: 'TOR', name: 'Toronto Blue Jays' },
    { id: 116, abbrev: 'DET', name: 'Detroit Tigers' },
    { id: 145, abbrev: 'CWS', name: 'Chicago White Sox' },
    { id: 114, abbrev: 'CLE', name: 'Cleveland Guardians' },
    { id: 142, abbrev: 'MIN', name: 'Minnesota Twins' },
    { id: 118, abbrev: 'KC', name: 'Kansas City Royals' },
    { id: 117, abbrev: 'HOU', name: 'Houston Astros' },
  ]

  const raw: RawPlayerInput[] = []
  teams.forEach((team, teamIndex) => {
    raw.push(...sampleHitters(team.id, team.abbrev, team.name, 10000 + teamIndex * 100))
    raw.push(...samplePitchers(team.id, team.abbrev, team.name, 20000 + teamIndex * 100))
  })

  const players = mapRawPlayersToLive(raw).filter((p) => p.teamId !== 119)
  const opponentPlayers = mapRawPlayersToLive(raw.filter((p) => p.teamId === 119))

  const lineup: Partial<Record<DailyLineupPosition, (typeof opponentPlayers)[number]>> = {}
  const hitters = opponentPlayers.filter((p) => p.role === 'hitter')
  const pitchers = opponentPlayers.filter((p) => p.role === 'pitcher')
  lineup.C = hitters[0]
  lineup['1B'] = hitters[1]
  lineup['2B'] = hitters[2]
  lineup['3B'] = hitters[3]
  lineup.SS = hitters[4]
  lineup.OF1 = hitters[5]
  lineup.OF2 = hitters[6]
  lineup.OF3 = hitters[7]
  lineup.DH = hitters[8]
  lineup.SP = pitchers[0]
  lineup.RP = pitchers[1]
  lineup.CL = pitchers[2]

  return {
    kind: 'daily-matchup',
    challengeDate,
    targetDate,
    available: true,
    opponent: {
      teamId: 119,
      teamAbbrev: 'LAD',
      teamName: 'Los Angeles Dodgers',
      lineup,
      battingOrder: hitters.slice(0, 9),
    },
    opponentGameScore: { runs: 12, hits: 15, runDiff: 5 },
    players,
    simSeed: dailyMatchupSnapshotSeed(challengeDate, targetDate, 119),
  }
}

export function buildFixtureLiveDraftSnapshot(challengeDate: string): LiveDraftSnapshot {
  const teams = [
    { id: 119, abbrev: 'LAD', name: 'Los Angeles Dodgers' },
    { id: 147, abbrev: 'NYY', name: 'New York Yankees' },
    { id: 111, abbrev: 'BOS', name: 'Boston Red Sox' },
    { id: 121, abbrev: 'NYM', name: 'New York Mets' },
    { id: 120, abbrev: 'WSH', name: 'Washington Nationals' },
    { id: 110, abbrev: 'BAL', name: 'Baltimore Orioles' },
    { id: 139, abbrev: 'TB', name: 'Tampa Bay Rays' },
    { id: 141, abbrev: 'TOR', name: 'Toronto Blue Jays' },
    { id: 116, abbrev: 'DET', name: 'Detroit Tigers' },
    { id: 145, abbrev: 'CWS', name: 'Chicago White Sox' },
    { id: 114, abbrev: 'CLE', name: 'Cleveland Guardians' },
    { id: 142, abbrev: 'MIN', name: 'Minnesota Twins' },
    { id: 118, abbrev: 'KC', name: 'Kansas City Royals' },
    { id: 117, abbrev: 'HOU', name: 'Houston Astros' },
    { id: 136, abbrev: 'SEA', name: 'Seattle Mariners' },
  ]

  const raw: RawPlayerInput[] = []
  teams.forEach((team, teamIndex) => {
    raw.push(...sampleHitters(team.id, team.abbrev, team.name, 30000 + teamIndex * 100))
    raw.push(...samplePitchers(team.id, team.abbrev, team.name, 40000 + teamIndex * 100))
  })

  return {
    kind: 'live-draft',
    challengeDate,
    players: mapRawPlayersToLive(raw),
    coinFlipUserFirst: challengeDate.charCodeAt(0) % 2 === 0,
    simSeed: liveDraftSnapshotSeed(challengeDate),
  }
}
