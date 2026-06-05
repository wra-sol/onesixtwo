import { franchiseDisplayName } from '../../src/data/franchises.ts'
import { STANDARD_RP_APPEARANCES } from '../../src/lib/calibration.ts'
import {
  isDedicatedReliefEligible,
  reliefProfileFromStats,
  starterProfileFromStats,
} from '../../src/lib/player-eligibility.ts'
import {
  HITTER_AVG_ANCHORS,
  HITTER_HR_PER_162_ANCHORS,
  HITTER_OPS_ANCHORS,
  HITTER_RBI_PER_162_ANCHORS,
  HITTER_SB_PER_162_ANCHORS,
  PITCHER_ERA_ANCHORS,
  PITCHER_IP_PER_30GS_ANCHORS,
  PITCHER_K9_ANCHORS,
  PITCHER_SAVES_PER_70_RP_ANCHORS,
  PITCHER_WHIP_ANCHORS,
  per162,
  scoreFromAnchors,
} from '../../src/lib/rating-anchors.ts'
import type {
  Era,
  HitterStats,
  LineupPosition,
  PitcherStats,
  Player,
  PlayerRatings,
  TeamId,
} from '../../src/lib/types.ts'
import type { MlbPersonWithStats } from './mlb-stats-api.ts'

const ACTIVE_ERA: Era = '2020s'

type HittingAgg = {
  ab: number
  h: number
  doubles: number
  triples: number
  hr: number
  rbi: number
  sb: number
  bb: number
  g: number
}

type PitchingAgg = {
  g: number
  gs: number
  ipOuts: number
  er: number
  so: number
  w: number
  sv: number
  hAllowed: number
  bbAllowed: number
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatAvg(h: number, ab: number): string {
  if (ab < 1) return '.250'
  const v = h / ab
  return v >= 1 ? '.999' : `.${Math.min(999, Math.round(v * 1000)).toString().padStart(3, '0')}`
}

function formatEra(er: number, ipOuts: number): string {
  if (ipOuts < 1) return '4.00'
  const ip = ipOuts / 3
  return ((er * 9) / ip).toFixed(2)
}

function formatWhip(h: number, bb: number, ipOuts: number): string {
  if (ipOuts < 1) return '1.30'
  const ip = ipOuts / 3
  return ((h + bb) / ip).toFixed(2)
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '.000'
  return value >= 1
    ? '.999'
    : `.${Math.min(999, Math.round(value * 1000)).toString().padStart(3, '0')}`
}

function formatObp(h: number, bb: number, ab: number): string {
  const pa = ab + bb
  if (pa < 1) return '.000'
  return formatRate((h + bb) / pa)
}

function formatSlg(
  h: number,
  doubles: number,
  triples: number,
  hr: number,
  ab: number,
): string {
  if (ab < 1) return '.000'
  const tb = h + doubles + 2 * triples + 3 * hr
  return formatRate(tb / ab)
}

function formatOps(
  h: number,
  ab: number,
  bb: number,
  doubles: number,
  triples: number,
  hr: number,
): string {
  if (ab < 1) return '.700'
  const pa = ab + bb
  const obp = (h + bb) / pa
  const tb = h + doubles + 2 * triples + 3 * hr
  const slg = tb / ab
  return (obp + slg).toFixed(3).replace(/^0/, '')
}

function hitterRatings(
  contact: number,
  power: number,
  speed: number,
  runProduction: number,
  ops: number,
): PlayerRatings {
  const overall = Math.round(
    ops * 0.4 + power * 0.25 + contact * 0.2 + runProduction * 0.15,
  )
  return {
    contact,
    power,
    speed,
    runProduction,
    ops,
    era: 0,
    whip: 0,
    strikeouts: 0,
    wins: 0,
    saves: 0,
    workload: 0,
    overall,
  }
}

function pitcherRatings(
  era: number,
  whip: number,
  strikeouts: number,
  wins: number,
  workload: number,
  saves: number,
  overall?: number,
): PlayerRatings {
  const computedOverall = Math.round(
    era * 0.35 + whip * 0.25 + strikeouts * 0.25 + workload * 0.15,
  )
  return {
    contact: 0,
    power: 0,
    speed: 0,
    runProduction: 0,
    ops: 0,
    era,
    whip,
    strikeouts,
    wins,
    saves,
    workload,
    overall: overall ?? computedOverall,
  }
}

function computeOps(agg: HittingAgg): number {
  const ab = agg.ab || 1
  const pa = ab + agg.bb
  const obp = pa > 0 ? (agg.h + agg.bb) / pa : 0
  const slg = (agg.h + agg.doubles + 2 * agg.triples + 3 * agg.hr) / ab
  return obp + slg
}

function ratingsFromHitting(agg: HittingAgg): PlayerRatings {
  const ab = agg.ab || 1
  const g = Math.max(agg.g, 1)
  const avg = agg.h / ab
  const ops = computeOps(agg)
  const contact = scoreFromAnchors(avg, HITTER_AVG_ANCHORS)
  const power = scoreFromAnchors(per162(agg.hr, g), HITTER_HR_PER_162_ANCHORS)
  const speed = scoreFromAnchors(per162(agg.sb, g), HITTER_SB_PER_162_ANCHORS)
  const runProduction = scoreFromAnchors(
    per162(agg.rbi, g),
    HITTER_RBI_PER_162_ANCHORS,
  )
  const opsScore = scoreFromAnchors(ops, HITTER_OPS_ANCHORS)
  return hitterRatings(contact, power, speed, runProduction, opsScore)
}

function ratingsFromPitching(agg: PitchingAgg): PlayerRatings {
  const ip = agg.ipOuts / 3
  const eraVal = ip > 0 ? (agg.er * 9) / ip : 4.5
  const whipVal = ip > 0 ? (agg.hAllowed + agg.bbAllowed) / ip : 1.35
  const k9 = ip > 0 ? (agg.so * 9) / ip : 0
  const gs = Math.max(agg.gs, 1)
  const ipPer30Gs = (ip / gs) * 30
  const reliefGames = Math.max(0, agg.g - agg.gs)
  const isRelief = reliefProfileFromStats(agg.gs, agg.g, reliefGames)
  const savesPer70 =
    reliefGames > 0 ? (agg.sv / reliefGames) * STANDARD_RP_APPEARANCES : 0

  const eraScore = scoreFromAnchors(eraVal, PITCHER_ERA_ANCHORS, {
    lowerIsBetter: true,
  })
  const whipScore = scoreFromAnchors(whipVal, PITCHER_WHIP_ANCHORS, {
    lowerIsBetter: true,
  })
  const kScore = scoreFromAnchors(k9, PITCHER_K9_ANCHORS)
  const workload = scoreFromAnchors(ipPer30Gs, PITCHER_IP_PER_30GS_ANCHORS)
  const wScore = scoreFromAnchors(agg.w, [
    { value: 0, score: 50 },
    { value: 200, score: 92 },
  ])
  const savesScore = scoreFromAnchors(
    savesPer70,
    PITCHER_SAVES_PER_70_RP_ANCHORS,
  )

  if (isRelief) {
    const overall = Math.round(
      eraScore * 0.25 + whipScore * 0.2 + kScore * 0.2 + savesScore * 0.35,
    )
    return pitcherRatings(
      eraScore,
      whipScore,
      kScore,
      wScore,
      workload,
      savesScore,
      overall,
    )
  }

  return pitcherRatings(eraScore, whipScore, kScore, wScore, workload, 50)
}

function buildHitterStats(agg: HittingAgg): HitterStats {
  const pa = agg.ab + agg.bb
  return {
    avg: formatAvg(agg.h, agg.ab),
    obp: formatObp(agg.h, agg.bb, agg.ab),
    slg: formatSlg(agg.h, agg.doubles, agg.triples, agg.hr, agg.ab),
    hr: agg.hr,
    rbi: agg.rbi,
    sb: agg.sb,
    ops: formatOps(agg.h, agg.ab, agg.bb, agg.doubles, agg.triples, agg.hr),
    pa: pa > 0 ? pa : undefined,
    g: agg.g > 0 ? agg.g : undefined,
  }
}

function buildPitcherStats(agg: PitchingAgg): PitcherStats {
  const gs = agg.gs > 0 ? agg.gs : Math.max(agg.g, 1)
  const g = Math.max(agg.g, gs)
  const ip = agg.ipOuts / 3
  return {
    era: formatEra(agg.er, agg.ipOuts),
    whip: formatWhip(agg.hAllowed, agg.bbAllowed, agg.ipOuts),
    so: agg.so,
    wins: agg.w,
    gs,
    g,
    reliefGames: Math.max(0, g - gs),
    ip,
    saves: agg.sv,
  }
}

function findSeasonSplit(
  person: MlbPersonWithStats,
  group: 'hitting' | 'pitching' | 'fielding',
): Record<string, string | number> | null {
  for (const entry of person.stats ?? []) {
    const groupName = entry.group?.displayName?.toLowerCase() ?? ''
    const typeName = entry.type?.displayName?.toLowerCase() ?? ''
    if (groupName !== group || !typeName.includes('season')) continue
    const seasonSplit = entry.splits?.[0]
    if (seasonSplit?.stat) return seasonSplit.stat
  }
  return null
}

function hittingAggFromSplit(stat: Record<string, string | number> | null): HittingAgg | null {
  if (!stat) return null
  const ab = num(stat.atBats)
  if (ab < 1 && num(stat.plateAppearances) < 1) return null
  return {
    ab,
    h: num(stat.hits),
    doubles: num(stat.doubles),
    triples: num(stat.triples),
    hr: num(stat.homeRuns),
    rbi: num(stat.rbi),
    sb: num(stat.stolenBases),
    bb: num(stat.baseOnBalls),
    g: num(stat.gamesPlayed) || num(stat.games),
  }
}

function pitchingAggFromSplit(stat: Record<string, string | number> | null): PitchingAgg | null {
  if (!stat) return null
  const ipStr = String(stat.inningsPitched ?? '0')
  const ip = Number.parseFloat(ipStr)
  if (!Number.isFinite(ip) || ip <= 0) return null
  const ipOuts = Math.round(ip * 3)
  const era = num(stat.era)
  const er = era > 0 ? (era * ip) / 9 : 0
  return {
    g: num(stat.gamesPlayed) || num(stat.games),
    gs: num(stat.gamesStarted),
    ipOuts,
    er,
    so: num(stat.strikeOuts),
    w: num(stat.wins),
    sv: num(stat.saves),
    hAllowed: num(stat.hits),
    bbAllowed: num(stat.baseOnBalls),
  }
}

const POSITION_CODE_MAP: Record<string, LineupPosition> = {
  '1': 'SP',
  '2': 'C',
  '3': '1B',
  '4': '2B',
  '5': '3B',
  '6': 'SS',
  '7': 'LF',
  '8': 'CF',
  '9': 'RF',
  '10': 'DH',
  P: 'SP',
  C: 'C',
  '1B': '1B',
  '2B': '2B',
  '3B': '3B',
  SS: 'SS',
  LF: 'LF',
  CF: 'CF',
  RF: 'RF',
  DH: 'DH',
  OF: 'LF',
}

export function positionsFromMlbCodes(codes: string[]): LineupPosition[] {
  const set = new Set<LineupPosition>()
  for (const code of codes) {
    const mapped = POSITION_CODE_MAP[code]
    if (mapped) set.add(mapped)
  }
  const order: LineupPosition[] = [
    'SP',
    'RP',
    'C',
    '1B',
    '2B',
    '3B',
    'SS',
    'LF',
    'CF',
    'RF',
    'DH',
  ]
  return order.filter((pos) => set.has(pos))
}

function finalizePositions(
  role: Player['role'],
  positions: LineupPosition[],
  pitching?: PitchingAgg,
): LineupPosition[] {
  const set = new Set(positions)
  if (role === 'pitcher' || role === 'two-way') {
    const gs = pitching?.gs ?? 0
    const g = pitching?.g ?? gs
    const reliefGames = Math.max(0, g - gs)
    if (starterProfileFromStats(gs, g, reliefGames)) set.add('SP')
    if (reliefProfileFromStats(gs, g, reliefGames)) set.add('RP')
    if (role === 'pitcher' && !set.has('SP') && !set.has('RP')) set.add('SP')
  }
  if (role === 'hitter' || role === 'two-way') {
    set.add('DH')
  }
  const order: LineupPosition[] = [
    'SP',
    'RP',
    'C',
    '1B',
    '2B',
    '3B',
    'SS',
    'LF',
    'CF',
    'RF',
    'DH',
  ]
  if (role === 'pitcher') {
    const pitchingPositions = order.filter(
      (pos) => (pos === 'SP' || pos === 'RP') && set.has(pos),
    )
    return pitchingPositions.length > 0 ? pitchingPositions : ['SP']
  }
  return order.filter((pos) => set.has(pos))
}

export type ActivePlayerInput = {
  personId: string
  mlbPersonId: number
  name: string
  teamId: TeamId
  positionCodes: string[]
  person: MlbPersonWithStats
}

export function buildActivePlayerCard(
  input: ActivePlayerInput,
  rank: number,
): Player | null {
  const hitting = hittingAggFromSplit(findSeasonSplit(input.person, 'hitting'))
  const pitching = pitchingAggFromSplit(findSeasonSplit(input.person, 'pitching'))

  let role: Player['role'] = 'hitter'
  if (hitting && pitching) {
    role = 'two-way'
  } else if (pitching && !hitting) {
    role = 'pitcher'
  } else if (!hitting) {
    return null
  }

  const teamName = franchiseDisplayName(input.teamId, ACTIVE_ERA)
  const positions = finalizePositions(
    role,
    positionsFromMlbCodes(input.positionCodes),
    pitching ?? undefined,
  )
  const id = `active-${input.personId}-${input.teamId}`

  if (role === 'two-way' && hitting && pitching) {
    const battingRatings = ratingsFromHitting(hitting)
    const pitchingRatings = ratingsFromPitching(pitching)
    const battingStats = buildHitterStats(hitting)
    const pitchingStats = buildPitcherStats(pitching)
    const primaryRole: 'hitter' | 'pitcher' =
      battingRatings.overall >= pitchingRatings.overall ? 'hitter' : 'pitcher'
    const overall = Math.round(
      battingRatings.overall * 0.55 + pitchingRatings.overall * 0.45,
    )
    return {
      id,
      personId: input.personId,
      name: input.name,
      teamId: input.teamId,
      teamName,
      era: ACTIVE_ERA,
      role,
      positions,
      stats: battingStats,
      ratings: { ...battingRatings, ...pitchingRatings, overall },
      battingStats,
      pitchingStats,
      battingRatings,
      pitchingRatings,
      twoWay: {
        battingValue: battingRatings.overall,
        pitchingValue: pitchingRatings.overall,
        primaryRole,
      },
      bucketRank: rank,
    }
  }

  if (role === 'pitcher' && pitching) {
    const ratings = ratingsFromPitching(pitching)
    return {
      id,
      personId: input.personId,
      name: input.name,
      teamId: input.teamId,
      teamName,
      era: ACTIVE_ERA,
      role,
      positions,
      stats: buildPitcherStats(pitching),
      ratings,
      bucketRank: rank,
    }
  }

  if (role === 'hitter' && hitting) {
    const ratings = ratingsFromHitting(hitting)
    return {
      id,
      personId: input.personId,
      name: input.name,
      teamId: input.teamId,
      teamName,
      era: ACTIVE_ERA,
      role,
      positions,
      stats: buildHitterStats(hitting),
      ratings,
      bucketRank: rank,
    }
  }

  return null
}

export function personIdFromMlbId(mlbPersonId: number): string {
  return `mlb-${mlbPersonId}`
}

export { ACTIVE_ERA }
