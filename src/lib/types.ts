export const LINEUP_POSITIONS = [
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'P',
] as const

export type LineupPosition = (typeof LINEUP_POSITIONS)[number]

export type Era =
  | '1910s'
  | '1920s'
  | '1930s'
  | '1940s'
  | '1950s'
  | '1960s'
  | '1970s'
  | '1980s'
  | '1990s'
  | '2000s'
  | '2010s'
  | '2020s'

export type TeamId =
  | 'yankees'
  | 'red-sox'
  | 'rays'
  | 'blue-jays'
  | 'orioles'
  | 'white-sox'
  | 'guardians'
  | 'tigers'
  | 'royals'
  | 'twins'
  | 'astros'
  | 'angels'
  | 'athletics'
  | 'mariners'
  | 'rangers'
  | 'braves'
  | 'marlins'
  | 'mets'
  | 'phillies'
  | 'nationals'
  | 'cubs'
  | 'reds'
  | 'brewers'
  | 'pirates'
  | 'cardinals'
  | 'dodgers'
  | 'giants'
  | 'padres'
  | 'rockies'
  | 'diamondbacks'

export type PlayerRole = 'hitter' | 'pitcher'

export type HitterStats = {
  avg: string
  obp?: string
  slg?: string
  hr: number
  rbi: number
  sb: number
  ops: string
  /** Games played in source window (decade/career) for season proration. */
  g?: number
  /** Fielding errors in source window (team-era card). */
  errors?: number
  /** Fielding games in source window for error rate proration. */
  fieldingGames?: number
}

export type PitcherStats = {
  era: string
  whip: string
  so: number
  wins: number
  /** Games started in source window for 30-start proration. */
  gs?: number
}

export type PlayerRatings = {
  contact: number
  power: number
  speed: number
  runProduction: number
  ops: number
  era: number
  whip: number
  strikeouts: number
  wins: number
  workload: number
  overall: number
  war?: number
}

export type Player = {
  id: string
  personId: string
  name: string
  teamId: TeamId
  teamName: string
  era: Era
  role: PlayerRole
  positions: LineupPosition[]
  stats: HitterStats | PitcherStats
  ratings: PlayerRatings
  bucketRank?: number
}

export type DraftBucket = {
  id: string
  teamId: TeamId
  teamName: string
  era: Era
  playerIds: string[]
}

export type Lineup = Record<LineupPosition, Player | null>

export type GameStatus =
  | 'intro'
  | 'spinning'
  | 'picking'
  | 'assigning'
  | 'complete'
  | 'stuck'

/** What the spin animation should resolve to when it finishes. */
export type SpinIntent = 'round' | 'team' | 'year'

export type DraftHistoryEntry = {
  round: number
  teamName: string
  era: Era
  playerName: string
  position: LineupPosition
}

export type GameState = {
  round: number
  currentBucket: DraftBucket | null
  availablePlayers: Player[]
  selectedPlayerId: string | null
  lineup: Lineup
  draftedPlayerIds: string[]
  draftedPersonIds: string[]
  history: DraftHistoryEntry[]
  status: GameStatus
  /** Once per game: reroll franchise, keep the same decade. */
  teamRespinUsed: boolean
  /** Once per game: reroll decade, keep the same franchise. */
  yearRespinUsed: boolean
  spinIntent: SpinIntent
}

export type CategoryScore = {
  label: string
  value: number
}

export type SimulationSeed = string

export type SeasonSegment = 'early' | 'middle' | 'late'

export type SeasonNoteType =
  | 'streak'
  | 'slump'
  | 'closeGames'
  | 'blowouts'
  | 'offense'
  | 'pitching'
  | 'starPlayer'
  | 'weakness'
  | 'expectation'

export type SeasonNoteSource = {
  segment: SeasonSegment
  type: SeasonNoteType
  importance: number
  playerId?: string
  position?: LineupPosition
  gradeLabel?: string
}

export type SimulatedGame = {
  won: boolean
  close: boolean
  blowout: boolean
  offenseDriven: boolean
  pitchingDriven: boolean
  segment: SeasonSegment
}

export type SeasonSimulation = {
  wins: number
  losses: number
  record: string
  expectedWins: number
  luckDelta: number
  expectationResult: 'exceeded' | 'met' | 'fell_short'
  longestWinStreak: number
  longestLosingStreak: number
  closeGameRecord: string
  blowoutRecord: string
  offenseDrivenWins: number
  pitchingDrivenWins: number
  closeWins: number
  closeLosses: number
  blowoutWins: number
  blowoutLosses: number
  noteSources: SeasonNoteSource[]
  seed: SimulationSeed
}

export type SeasonTier = {
  label: string
  description: string
  tone: 'perfect' | 'dynasty' | 'contender' | 'playoff' | 'rebuild'
}

export type SeasonMoment = {
  text: string
  importance: number
}

export type TeamGrade = {
  label: string
  value: number
  displayGrade: string
}

export type LineupIdentity = {
  id: string
  label: string
  description: string
}

export type RosterScorecardRow = {
  position: LineupPosition
  playerId: string
  playerName: string
  role: PlayerRole
  teamName: string
  era: Era
  slashLine: string
  countingLine: string
  statNote?: string
}

export type RosterScorecard = {
  rows: RosterScorecardRow[]
  teamGrades: TeamGrade[]
  identity: LineupIdentity
  strengths: CategoryScore[]
  weaknesses: CategoryScore[]
}

export type SeasonResultOptions = {
  rerollSeed?: SimulationSeed
}

export type SeasonResult = {
  wins: number
  losses: number
  record: string
  headline: string
  teamScore: number
  overallRating: number
  categories: CategoryScore[]
  isPerfectSeason: boolean
  bestPlayer: {
    name: string
    position: LineupPosition
    highlightCategory: CategoryScore
  } | null
  weakestPlayer: {
    name: string
    position: LineupPosition
    highlightCategory: CategoryScore
  } | null
  gamesFromPerfect: number
  shareText: string
  tier: SeasonTier
  identity: LineupIdentity
  strengths: CategoryScore[]
  weaknesses: CategoryScore[]
  seasonMoments: SeasonMoment[]
  simulation: SeasonSimulation
  scorecard: RosterScorecard
  expectedWins: number
  luckDelta: number
  signatureMoment: string | null
}

export type RandomSource = () => number
