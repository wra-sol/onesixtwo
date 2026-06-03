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
  hr: number
  rbi: number
  sb: number
  ops: string
}

export type PitcherStats = {
  era: string
  whip: string
  so: number
  wins: number
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
}

export type CategoryScore = {
  label: string
  value: number
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
  bestPlayer: { name: string; position: LineupPosition; overall: number } | null
  weakestPlayer: { name: string; position: LineupPosition; overall: number } | null
  gamesFromPerfect: number
  shareText: string
}

export type RandomSource = () => number
