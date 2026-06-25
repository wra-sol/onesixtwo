import type { DailyLineupPosition } from './daily-roster'

export type LiveModeId = 'daily-matchup' | 'live-draft'

export type LivePlayerRole = 'hitter' | 'pitcher'

export type DisplayGrade20 = 20 | 30 | 40 | 50 | 60 | 70 | 80

export type GradeLabel =
  | 'Poor'
  | 'Well Below Avg'
  | 'Below Avg'
  | 'Average'
  | 'Plus'
  | 'Plus-Plus'
  | 'Elite'

export type LivePlayerGrades = {
  contact?: number
  power?: number
  speed?: number
  defense?: number
  stuff?: number
  command?: number
  stamina?: number
  overall: number
}

export type PitcherRoleSlot = 'SP' | 'RP' | 'CL'

export type LivePlayerPosition =
  | 'C'
  | '1B'
  | '2B'
  | '3B'
  | 'SS'
  | 'LF'
  | 'CF'
  | 'RF'
  | 'OF'
  | 'DH'
  | 'SP'
  | 'RP'
  | 'CL'

export type LivePlayer = {
  id: string
  personId: number
  name: string
  teamId: number
  teamAbbrev: string
  teamName: string
  positions: LivePlayerPosition[]
  role: LivePlayerRole
  batSide?: 'L' | 'R' | 'S'
  pitchHand?: 'L' | 'R'
  grades: LivePlayerGrades
  appearedOnTargetDate: boolean
  isFallback: boolean
  pitcherRoles?: PitcherRoleSlot[]
}

export type OpponentRoster = {
  teamId: number
  teamAbbrev: string
  teamName: string
  lineup: Partial<Record<DailyLineupPosition, LivePlayer>>
  battingOrder: LivePlayer[]
}

export type DailyMatchupSnapshot = {
  kind: 'daily-matchup'
  challengeDate: string
  targetDate: string
  available: boolean
  unavailableReason?: string
  opponent: OpponentRoster | null
  opponentGameScore: { runs: number; hits: number; runDiff: number }
  players: LivePlayer[]
  simSeed: string
  fallback?: boolean
  error?: string
}

export type LiveDraftSnapshot = {
  kind: 'live-draft'
  challengeDate: string
  players: LivePlayer[]
  coinFlipUserFirst: boolean
  simSeed: string
  fallback?: boolean
  error?: string
}

export type LiveSnapshot = DailyMatchupSnapshot | LiveDraftSnapshot

export type PaEventType =
  | 'out'
  | 'strikeout'
  | 'walk'
  | 'single'
  | 'double'
  | 'triple'
  | 'home_run'
  | 'steal'
  | 'caught_stealing'
  | 'run_scored'

export type PaEvent = {
  inning: number
  half: 'top' | 'bottom'
  batterName: string
  pitcherName: string
  type: PaEventType
  description: string
  runsScored: number
}

export type SimBoxScore = {
  runs: number
  hits: number
  errors: number
  homeRuns: number
}

export type SimulatedGame = {
  homeScore: number
  awayScore: number
  homeBox: SimBoxScore
  awayBox: SimBoxScore
  events: PaEvent[]
  userWasHome: boolean
}

export type SimulatedSeries = {
  games: SimulatedGame[]
  userWins: number
  opponentWins: number
  userRuns: number
  opponentRuns: number
  userRunDiff: number
  wonSeries: boolean
  seed: string
}

export type LiveDraftRoundTeam = {
  teamId: number
  teamAbbrev: string
  teamName: string
}

export type LiveDraftPick = {
  pickNumber: number
  side: 'user' | 'ai'
  playerId: string
  position: DailyLineupPosition
  round: number
  roundTeamId: number
}

export type LiveDraftState = {
  mode: 'live-draft'
  challengeDate: string
  coinFlipUserFirst: boolean
  currentPick: number
  userLineup: import('./daily-roster').DailyLineup
  aiLineup: import('./daily-roster').DailyLineup
  userBattingOrder: LivePlayer[]
  aiBattingOrder: LivePlayer[]
  draftedPlayerIds: string[]
  picks: LiveDraftPick[]
  status: 'drafting' | 'lineup' | 'complete' | 'stuck'
  userPicksFirst: boolean
  roundStatus: 'spinning' | 'picking'
  round: number
  currentTeam: LiveDraftRoundTeam | null
  roundPickIds: string[]
  userRerollUsed: boolean
  aiRerollUsed: boolean
  usedRoundTeamIds: number[]
  roundTeams: LiveDraftRoundTeam[]
  pendingRerollSide: 'user' | 'ai' | null
}

export type DailyMatchupDraftState = {
  mode: 'daily-matchup'
  challengeDate: string
  targetDate: string
  opponent: OpponentRoster
  lineup: import('./daily-roster').DailyLineup
  battingOrder: LivePlayer[]
  draftedPlayerIds: string[]
  draftedTeamIds: number[]
  status: 'drafting' | 'lineup' | 'complete'
}

export type LiveLeaderboardEntryRow = {
  initials: string
  mode: LiveModeId
  challengeDate: string
  targetDate?: string
  seriesWins: number
  seriesLosses: number
  userRuns: number
  opponentRuns: number
  runDiff: number
  wonSeries: boolean
  createdAt: number
  sharePath: string
  lineupSummary: string
  opponentName?: string
}

export type LiveShareInput = {
  mode: LiveModeId
  challengeDate: string
  targetDate?: string
  playerIds: string[]
  battingOrderIds: string[]
  aiPlayerIds?: string[]
  simSeed: string
}

export type LiveSubmitPayload = {
  mode: LiveModeId
  challengeDate: string
  targetDate?: string
  initials: string
  playerIds: string[]
  battingOrderIds: string[]
  aiPlayerIds?: string[]
  draftTranscript?: string
  simSeed: string
}

export function compareLiveLeaderboardRows(
  a: Pick<
    LiveLeaderboardEntryRow,
    'wonSeries' | 'seriesWins' | 'runDiff' | 'userRuns' | 'createdAt'
  >,
  b: Pick<
    LiveLeaderboardEntryRow,
    'wonSeries' | 'seriesWins' | 'runDiff' | 'userRuns' | 'createdAt'
  >,
): number {
  if (a.wonSeries !== b.wonSeries) return a.wonSeries ? -1 : 1
  if (a.seriesWins !== b.seriesWins) return b.seriesWins - a.seriesWins
  if (a.runDiff !== b.runDiff) return b.runDiff - a.runDiff
  if (a.userRuns !== b.userRuns) return b.userRuns - a.userRuns
  return a.createdAt - b.createdAt
}
