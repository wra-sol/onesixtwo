import { calculateRunPrevention } from './run-prevention'
import { getBattingRatings, getPitchingRatings } from './player-ratings'
import {
  pitchingContributors,
  pitcherComponentScore,
  reliefComponentScore,
} from './pitching-contributors'
import {
  getActiveLineupPositions,
  lineupEntries,
  lineupPlayers,
  rosterFormatSlotCount,
} from './roster-format'
import { playerHasBattingProfile, isReliefEligible, isStarterEligible } from './player-eligibility'
import type {
  Lineup,
  Player,
  RosterFormatId,
  ScoreExplanation,
} from './types'

const RISK_FACTOR_LABELS = new Set([
  'Run Prevention',
  'Control',
  'Dominance',
  'Power',
  'Contact',
  'Run Production',
  'Workload',
  'Balance',
])

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function battingContributors(lineup: Lineup, formatId: RosterFormatId): Player[] {
  const seen = new Set<string>()
  const out: Player[] = []
  for (const { player } of lineupEntries(lineup, formatId)) {
    if (!playerHasBattingProfile(player)) continue
    if (seen.has(player.personId)) continue
    seen.add(player.personId)
    out.push(player)
  }
  return out
}

function offenseScoreFromBatters(batters: Player[]): number {
  if (batters.length === 0) return 50
  const ratings = batters.map(getBattingRatings)
  return Math.round(
    avg(ratings.map((r) => r.ops)) * 0.4 +
      avg(ratings.map((r) => r.power)) * 0.25 +
      avg(ratings.map((r) => r.contact)) * 0.2 +
      avg(ratings.map((r) => r.runProduction)) * 0.15,
  )
}

function roleFitScore(
  lineup: Lineup,
  formatId: RosterFormatId,
): { score: number; notes: string[] } {
  const notes: string[] = []
  let penalty = 0
  const sp = lineup.SP
  if (sp && !isStarterEligible(sp) && sp.role !== 'two-way') {
    penalty += 8
    notes.push('SP slot filled by a non-starter profile (role-fit penalty).')
  }
  const rp = lineup.RP
  if (getActiveLineupPositions(formatId).includes('RP') && rp) {
    if (!isReliefEligible(rp) && rp.role !== 'two-way') {
      penalty += 8
      notes.push('RP slot filled by a non-reliever profile (role-fit penalty).')
    }
  }
  return { score: Math.max(40, 100 - penalty), notes }
}

function twoWayBonus(lineup: Lineup, formatId: RosterFormatId): number {
  let bonus = 0
  for (const { player } of lineupEntries(lineup, formatId)) {
    if (player.role !== 'two-way' && !player.twoWay) continue
    const bat = getBattingRatings(player)
    const pit = getPitchingRatings(player)
    if (bat.overall >= 65 && pit.era >= 65) {
      bonus += 2
    }
  }
  return Math.min(6, bonus)
}

function formatNormalizationAdjustment(formatId: RosterFormatId): number {
  const slots = rosterFormatSlotCount(formatId)
  if (slots <= 9) return 0
  return (9 - slots) * 0.4
}

export function buildScoreExplanation(
  lineup: Lineup,
  formatId: RosterFormatId,
): ScoreExplanation {
  const players = lineupPlayers(lineup, formatId)
  const batters = battingContributors(lineup, formatId)
  const pitching = pitchingContributors(lineup, formatId)

  const offenseScore = offenseScoreFromBatters(batters)
  const starterScore = pitcherComponentScore(pitching.starters)
  const reliefScore = reliefComponentScore(pitching.relievers)
  const hasRpSlot = getActiveLineupPositions(formatId).includes('RP')

  const pitchingScore = hasRpSlot
    ? Math.round(starterScore * 0.72 + reliefScore * 0.28)
    : starterScore

  const runPrev = calculateRunPrevention(lineup, formatId)
  const pitchingScoreAdjusted = Math.round(
    pitchingScore * 0.65 + runPrev.value * 0.35,
  )

  const roleFit = roleFitScore(lineup, formatId)
  const overalls = players.map((p) => p.ratings.overall)
  const starPowerBonus =
    Math.max(...overalls, 0) >= 95 ? 3 : Math.max(...overalls, 0) >= 90 ? 1 : 0

  const batRatings = batters.map(getBattingRatings)
  const speedBonus =
    batRatings.length > 0 &&
    avg(batRatings.map((r) => r.speed)) >= 80 &&
    avg(batRatings.map((r) => r.contact)) >= 70
      ? 1
      : 0

  const twBonus = twoWayBonus(lineup, formatId)

  const grades = buildTeamGradesForExplanation(lineup, formatId, runPrev.value)
  const riskFactors = grades
    .filter((g) => RISK_FACTOR_LABELS.has(g.label) && g.value < 60)
    .filter((g) => g.label !== 'Speed')
    .sort((a, b) => a.value - b.value)
    .slice(0, 2)
    .map((g) => ({ label: g.label, value: g.value }))

  const notes = [...roleFit.notes]
  if (runPrev.errorPenalty > 0) {
    notes.push(
      `Fielding: ${runPrev.lineupErrorsPer162} errors per 162 (−${runPrev.errorPenalty} run prevention).`,
    )
  }
  if (twBonus > 0) {
    notes.push(`Two-way production bonus: +${twBonus}.`)
  }

  return {
    offenseScore,
    pitchingScore: pitchingScoreAdjusted,
    roleFitScore: roleFit.score,
    defensePenalty: runPrev.errorPenalty,
    starPowerBonus,
    twoWayBonus: twBonus,
    speedBonus,
    riskFactors,
    notes,
  }
}

function buildTeamGradesForExplanation(
  lineup: Lineup,
  formatId: RosterFormatId,
  runPreventionValue: number,
): { label: string; value: number }[] {
  const batters = battingContributors(lineup, formatId)
  const pitching = pitchingContributors(lineup, formatId)
  const players = lineupPlayers(lineup, formatId)
  const overalls = players.map((p) => p.ratings.overall)
  const avgOverall = avg(overalls)
  const variance =
    overalls.reduce((s, o) => s + (o - avgOverall) ** 2, 0) / Math.max(overalls.length, 1)

  const batRatings = batters.map(getBattingRatings)
  const pitRatings = pitching.all.map(getPitchingRatings)

  return [
    { label: 'Contact', value: Math.round(avg(batRatings.map((r) => r.contact))) },
    { label: 'Power', value: Math.round(avg(batRatings.map((r) => r.power))) },
    { label: 'Speed', value: Math.round(avg(batRatings.map((r) => r.speed))) },
    {
      label: 'Run Production',
      value: Math.round(avg(batRatings.map((r) => r.runProduction))),
    },
    { label: 'Run Prevention', value: runPreventionValue },
    { label: 'Control', value: Math.round(avg(pitRatings.map((r) => r.whip))) },
    {
      label: 'Dominance',
      value: Math.round(avg(pitRatings.map((r) => r.strikeouts))),
    },
    { label: 'Workload', value: Math.round(avg(pitRatings.map((r) => r.workload))) },
    { label: 'Balance', value: Math.max(0, Math.round(100 - Math.sqrt(variance) * 2)) },
    { label: 'Star Power', value: Math.round(Math.max(...overalls, 0)) },
  ]
}

export function calculateTeamScoreFromLineup(
  lineup: Lineup,
  formatId: RosterFormatId,
): number | null {
  const active = getActiveLineupPositions(formatId)
  if (active.some((pos) => lineup[pos] === null)) {
    return null
  }
  const explanation = buildScoreExplanation(lineup, formatId)
  const offenseScore = explanation.offenseScore
  const pitchingScore = explanation.pitchingScore
  const roleFit = explanation.roleFitScore
  const runPrev = calculateRunPrevention(lineup, formatId)

  return clamp(
    Math.round(
      offenseScore * 0.48 +
        pitchingScore * 0.42 +
        roleFit * 0.1 +
        explanation.starPowerBonus +
        explanation.twoWayBonus +
        explanation.speedBonus -
        runPrev.errorPenalty +
        formatNormalizationAdjustment(formatId),
    ),
    0,
    100,
  )
}
