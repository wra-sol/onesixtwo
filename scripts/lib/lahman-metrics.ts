import { isModernEra } from '../../src/data/franchises.ts'
import type { Era, TeamId } from '../../src/lib/types.ts'

export type LahmanAggMetrics = {
  playerID: string
  personId: string
  name: string
  teamId: TeamId
  decade: Era
  role: 'hitter' | 'pitcher'
  ab: number
  g: number
  gs: number
  ip: number
  fieldingErrors: number
  fieldingGames: number
  avg: number
  ops: number
  hrPer162: number
  rbiPer162: number
  sbPer162: number
  pitchingEra: number
  whip: number
  k9: number
  ipPer30Gs: number
  errorsPer162: number
}

export type AggregatedLike = {
  playerID: string
  personId: string
  name: string
  teamId: TeamId
  era: Era
  role: 'hitter' | 'pitcher'
  ab: number
  h: number
  doubles: number
  triples: number
  hr: number
  rbi: number
  sb: number
  bb: number
  hAllowed: number
  bbAllowed: number
  ipOuts: number
  er: number
  so: number
  g: number
  gs: number
  fieldingErrors: number
  fieldingGames: number
  valueScore: number
}

export function metricsFromAgg(agg: AggregatedLike): LahmanAggMetrics | null {
  if (agg.valueScore < 0) return null

  const g = Math.max(agg.g, 1)
  const ip = agg.ipOuts / 3
  const ab = agg.ab || 1
  const pa = ab + agg.bb
  const obp = pa > 0 ? (agg.h + agg.bb) / pa : 0
  const slg =
    ab > 0
      ? (agg.h + agg.doubles + 2 * agg.triples + 3 * agg.hr) / ab
      : 0
  const gs = Math.max(agg.gs, 1)

  return {
    playerID: agg.playerID,
    personId: agg.personId,
    name: agg.name,
    teamId: agg.teamId,
    decade: agg.era,
    role: agg.role,
    ab: agg.ab,
    g: agg.g,
    gs: agg.gs,
    ip,
    fieldingErrors: agg.fieldingErrors,
    fieldingGames: agg.fieldingGames,
    avg: agg.h / ab,
    ops: obp + slg,
    hrPer162: (agg.hr / g) * 162,
    rbiPer162: (agg.rbi / g) * 162,
    sbPer162: (agg.sb / g) * 162,
    pitchingEra: ip > 0 ? (agg.er * 9) / ip : 4.5,
    whip: ip > 0 ? (agg.hAllowed + agg.bbAllowed) / ip : 1.35,
    k9: ip > 0 ? (agg.so * 9) / ip : 0,
    ipPer30Gs: (ip / gs) * 30,
    errorsPer162:
      agg.fieldingGames > 0
        ? (agg.fieldingErrors / agg.fieldingGames) * 162
        : 0,
  }
}

export function isPlayableCardMetrics(metrics: LahmanAggMetrics): boolean {
  return isModernEra(metrics.decade)
}
