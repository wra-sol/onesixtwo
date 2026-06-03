import {
  formatSimulatedSlashLine,
  formatSimulatedTotals,
  SIMULATED_SEASON_STAT_NOTE,
} from './player-stats'
import { calculateRunPrevention } from './run-prevention'
import { getPlayerCategories, getPlayerTopCategory } from './game'
import {
  LINEUP_POSITIONS,
  type CategoryScore,
  type Lineup,
  type LineupIdentity,
  type Player,
  type RosterScorecard,
  type RosterScorecardRow,
  type SeasonSimulation,
  type TeamGrade,
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

export function valueToDisplayGrade(value: number): string {
  for (const { min, label } of GRADE_THRESHOLDS) {
    if (value >= min) return label
  }
  return 'C-'
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

export function buildTeamGrades(lineup: Lineup): TeamGrade[] {
  const players = LINEUP_POSITIONS.map((pos) => lineup[pos]!).filter(Boolean)
  const hitters = players.filter((p) => p.role === 'hitter')
  const pitchers = players.filter((p) => p.role === 'pitcher')
  const overalls = players.map((p) => p.ratings.overall)
  const avgOverall = avg(overalls)
  const variance =
    overalls.reduce((s, o) => s + (o - avgOverall) ** 2, 0) / overalls.length

  const grades: { label: string; value: number }[] = [
    { label: 'Contact', value: avg(hitters.map((p) => p.ratings.contact)) },
    { label: 'Power', value: avg(hitters.map((p) => p.ratings.power)) },
    { label: 'Speed', value: avg(hitters.map((p) => p.ratings.speed)) },
    {
      label: 'Run Production',
      value: avg(hitters.map((p) => p.ratings.runProduction)),
    },
    {
      label: 'Run Prevention',
      value: calculateRunPrevention(players).value,
    },
    { label: 'Control', value: avg(pitchers.map((p) => p.ratings.whip)) },
    {
      label: 'Dominance',
      value: avg(pitchers.map((p) => p.ratings.strikeouts)),
    },
    { label: 'Workload', value: avg(pitchers.map((p) => p.ratings.workload)) },
    { label: 'Balance', value: Math.max(0, 100 - Math.sqrt(variance) * 2) },
    { label: 'Star Power', value: Math.max(...overalls) },
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
    .filter((g) => g.label !== 'Star Power' && g.label !== 'Balance')
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

  const offenseAvg = (contact + power + speed) / 3

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
): { name: string; position: import('./types').LineupPosition } | null {
  const players = LINEUP_POSITIONS.map((pos) => ({
    position: pos,
    player: lineup[pos]!,
  }))
  const sorted = [...players].sort(
    (a, b) =>
      getPlayerTopCategory(b.player).value -
      getPlayerTopCategory(a.player).value,
  )
  const best = sorted[0]
  return best ? { name: best.player.name, position: best.position } : null
}

export function getRosterVulnerability(
  grades: TeamGrade[],
): CategoryScore | null {
  const bottom = getBottomTeamGrades(grades, 1)[0]
  return bottom
    ? { label: bottom.label, value: bottom.value }
    : null
}

function gradesToCategoryScores(grades: TeamGrade[]): CategoryScore[] {
  return grades.map((g) => ({ label: g.label, value: g.value }))
}

export function buildRosterScorecard(
  lineup: Lineup,
  simulation: Pick<SeasonSimulation, 'seed'>,
): RosterScorecard {
  const rows: RosterScorecardRow[] = LINEUP_POSITIONS.map((position) => {
    const player = lineup[position]!
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
      ),
      countingLine: formatSimulatedTotals(player),
      statNote: SIMULATED_SEASON_STAT_NOTE,
    }
  })

  const teamGrades = buildTeamGrades(lineup)
  const identity = getRosterIdentity(teamGrades)
  const strengths = gradesToCategoryScores(getTopTeamGrades(teamGrades, 3))
  const weaknesses = gradesToCategoryScores(getBottomTeamGrades(teamGrades, 2))

  return { rows, teamGrades, identity, strengths, weaknesses }
}

export { getPlayerCategories }
