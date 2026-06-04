import {
  formatSimulatedSlashLine,
  formatSimulatedTotals,
  SIMULATED_SEASON_STAT_NOTE,
} from './player-stats'
import { calculateRunPrevention } from './run-prevention'
import { getPlayerTopCategory } from './player-categories'
import {
  getActiveLineupPositions,
  lineupEntries,
  lineupPlayers,
} from './roster-format'
import { getBattingRatings, getPitchingRatings } from './player-ratings'
import { playerHasBattingProfile, playerHasPitchingProfile } from './player-eligibility'
import type {
  CategoryScore,
  Lineup,
  LineupIdentity,
  Player,
  RosterFormatId,
  RosterScorecard,
  RosterScorecardRow,
  SeasonSimulation,
  TeamGrade,
} from './types'

const GRADE_THRESHOLDS: { min: number; label: string }[] = [
  { min: 90, label: 'A+' },
  { min: 85, label: 'A' },
  { min: 80, label: 'A-' },
  { min: 75, label: 'B+' },
  { min: 70, label: 'B' },
  { min: 65, label: 'B-' },
  { min: 60, label: 'C+' },
  { min: 55, label: 'C' },
  { min: 0, label: 'C-' },
]

const RISK_GRADE_LABELS = new Set([
  'Run Prevention',
  'Control',
  'Dominance',
  'Power',
  'Contact',
  'Run Production',
  'Workload',
  'Balance',
])

export function valueToDisplayGrade(value: number): string {
  for (const { min, label } of GRADE_THRESHOLDS) {
    if (value >= min) return label
  }
  return 'C-'
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

export function buildTeamGrades(
  lineup: Lineup,
  formatId: RosterFormatId,
): TeamGrade[] {
  const players = lineupPlayers(lineup, formatId)
  const batters = players.filter((p) => playerHasBattingProfile(p))
  const pitchers = players.filter((p) => playerHasPitchingProfile(p))
  const overalls = players.map((p) => p.ratings.overall)
  const avgOverall = avg(overalls)
  const variance =
    overalls.reduce((s, o) => s + (o - avgOverall) ** 2, 0) /
    Math.max(overalls.length, 1)

  const batRatings = batters.map(getBattingRatings)
  const pitRatings = pitchers.map(getPitchingRatings)

  const grades: { label: string; value: number }[] = [
    { label: 'Contact', value: avg(batRatings.map((r) => r.contact)) },
    { label: 'Power', value: avg(batRatings.map((r) => r.power)) },
    { label: 'Speed', value: avg(batRatings.map((r) => r.speed)) },
    {
      label: 'Run Production',
      value: avg(batRatings.map((r) => r.runProduction)),
    },
    {
      label: 'Run Prevention',
      value: calculateRunPrevention(players).value,
    },
    { label: 'Control', value: avg(pitRatings.map((r) => r.whip)) },
    { label: 'Dominance', value: avg(pitRatings.map((r) => r.strikeouts)) },
    { label: 'Workload', value: avg(pitRatings.map((r) => r.workload)) },
    { label: 'Balance', value: Math.max(0, 100 - Math.sqrt(variance) * 2) },
    { label: 'Star Power', value: Math.max(...overalls, 0) },
  ]

  return grades.map((g) => ({
    label: g.label,
    value: Math.round(g.value),
    displayGrade: valueToDisplayGrade(g.value),
  }))
}

export function getTopTeamGrades(grades: TeamGrade[], count = 3): TeamGrade[] {
  return [...grades].sort((a, b) => b.value - a.value).slice(0, count)
}

export function getBottomTeamGrades(grades: TeamGrade[], count = 2): TeamGrade[] {
  return [...grades]
    .filter(
      (g) =>
        g.label !== 'Star Power' &&
        g.label !== 'Balance' &&
        g.label !== 'Speed' &&
        RISK_GRADE_LABELS.has(g.label),
    )
    .sort((a, b) => a.value - b.value)
    .slice(0, count)
}

export function getRosterIdentity(grades: TeamGrade[]): LineupIdentity {
  const byLabel = Object.fromEntries(grades.map((g) => [g.label, g.value]))
  const contact = byLabel['Contact'] ?? 0
  const power = byLabel['Power'] ?? 0
  const speed = byLabel['Speed'] ?? 0
  const runPrevention = byLabel['Run Prevention'] ?? 0
  const balance = byLabel['Balance'] ?? 0
  const starPower = byLabel['Star Power'] ?? 0

  const offenseAvg = (contact + power) / 2

  if (balance >= 75 && starPower >= 85 && offenseAvg >= 70 && runPrevention >= 70) {
    return {
      id: 'balanced-juggernaut',
      label: 'Balanced juggernaut',
      description: 'Contact, power, and run prevention all carry weight.',
    }
  }
  if (power >= 78 && power > contact + 8) {
    return {
      id: 'slugger-heavy',
      label: 'Slugger-heavy contender',
      description: 'The lineup wins with thump and run production.',
    }
  }
  if (runPrevention >= 78 && runPrevention > offenseAvg) {
    return {
      id: 'pitching-first',
      label: 'Pitching-first grinder',
      description: 'Run prevention and control set the floor every night.',
    }
  }
  if (speed >= 72 && contact >= 70 && speed > power) {
    return {
      id: 'speed-contact',
      label: 'Speed-and-contact chaos team',
      description: 'Pressure on the bases and contact keep the line moving.',
    }
  }
  if (starPower >= 88 && balance < 60) {
    return {
      id: 'stars-and-scrubs',
      label: 'Stars-and-scrubs simulator',
      description: 'Elite stars carry a volatile supporting cast.',
    }
  }
  if (balance >= 65 && offenseAvg >= 65 && runPrevention >= 65) {
    return {
      id: 'playoff-hunter',
      label: 'Thin-margin playoff hunter',
      description: 'No single weakness, but no clear separator either.',
    }
  }

  return {
    id: 'balanced',
    label: 'Balanced contender',
    description: 'A mix of strengths without one defining identity.',
  }
}

export function getPlayerContributionLabel(player: Player): string {
  if (player.role === 'two-way') return 'two-way star'
  if (player.role === 'pitcher') {
    const top = getPlayerTopCategory(player)
    if (top.label === 'Run Prevention') return 'ace run prevention'
    if (top.label === 'Dominance') return 'strikeout ace'
    if (top.label === 'Control') return 'control arm'
    return 'rotation anchor'
  }

  const top = getPlayerTopCategory(player)
  if (top.label === 'Power') return 'middle-order thump'
  if (top.label === 'Contact') return 'table setter'
  if (top.label === 'Speed') return 'defensive speed piece'
  if (top.label === 'Run Production') return 'run producer'
  return 'lineup piece'
}

export function getSignaturePlayer(
  lineup: Lineup,
  formatId: RosterFormatId,
): { name: string; position: import('./types').LineupPosition } | null {
  const entries = lineupEntries(lineup, formatId)
  const sorted = [...entries].sort(
    (a, b) =>
      getPlayerTopCategory(b.player).value -
      getPlayerTopCategory(a.player).value,
  )
  const best = sorted[0]
  return best ? { name: best.player.name, position: best.position } : null
}

function gradesToCategoryScores(grades: TeamGrade[]): CategoryScore[] {
  return grades.map((g) => ({ label: g.label, value: g.value }))
}

function buildRow(
  position: import('./types').LineupPosition,
  player: Player,
  simulation: Pick<SeasonSimulation, 'seed'>,
  profile?: 'batting' | 'pitching',
): RosterScorecardRow {
  return {
    position,
    playerId: player.id,
    playerName: player.name,
    role: player.role,
    teamName: player.teamName,
    era: player.era,
    slashLine: formatSimulatedSlashLine(
      player,
      simulation.seed,
      position,
      profile,
    ),
    countingLine: formatSimulatedTotals(player, position, profile),
    statNote: SIMULATED_SEASON_STAT_NOTE,
    twoWay: player.role === 'two-way',
  }
}

export function buildRosterScorecard(
  lineup: Lineup,
  simulation: Pick<SeasonSimulation, 'seed'>,
  formatId: RosterFormatId = 'classic',
): RosterScorecard {
  const rows: RosterScorecardRow[] = getActiveLineupPositions(formatId).map(
    (position) => buildRow(position, lineup[position]!, simulation),
  )

  const battingRows: RosterScorecardRow[] = []
  const pitchingRows: RosterScorecardRow[] = []
  const seenBat = new Set<string>()
  const seenPit = new Set<string>()

  for (const { position, player } of lineupEntries(lineup, formatId)) {
    if (playerHasBattingProfile(player) && !seenBat.has(player.personId)) {
      seenBat.add(player.personId)
      battingRows.push(buildRow(position, player, simulation, 'batting'))
    }
    if (playerHasPitchingProfile(player) && !seenPit.has(player.personId)) {
      seenPit.add(player.personId)
      pitchingRows.push(buildRow(position, player, simulation, 'pitching'))
    }
  }

  const teamGrades = buildTeamGrades(lineup, formatId)
  const identity = getRosterIdentity(teamGrades)
  const strengths = gradesToCategoryScores(getTopTeamGrades(teamGrades, 3))
  const riskFactors = gradesToCategoryScores(getBottomTeamGrades(teamGrades, 2))

  return {
    rows,
    battingRows,
    pitchingRows,
    teamGrades,
    identity,
    strengths,
    riskFactors,
    weaknesses: riskFactors,
  }
}
