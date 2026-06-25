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
}

export type LiveDraftSnapshot = {
  kind: 'live-draft'
  challengeDate: string
  players: LivePlayer[]
  coinFlipUserFirst: boolean
  simSeed: string
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

export type LiveDraftPick = {
  pickNumber: number
  side: 'user' | 'ai'
  playerId: string
  position: DailyLineupPosition
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
  userTeamIds: number[]
  aiTeamIds: number[]
  picks: LiveDraftPick[]
  status: 'drafting' | 'lineup' | 'complete'
  userPicksFirst: boolean
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
