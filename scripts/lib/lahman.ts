import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Era,
  HitterStats,
  LineupPosition,
  PitcherStats,
  Player,
  PlayerRatings,
  TeamId,
} from '../../src/lib/types.ts'
import {
  isDedicatedReliefEligible,
  reliefProfileFromStats,
  starterProfileFromStats,
} from '../../src/lib/player-eligibility.ts'
import { ERAS } from '../../src/data/franchises.ts'
import { decodeUnicodeEscapes } from '../../src/lib/text.ts'
import { parseCsv } from './parse-csv.ts'
import { lahmanFranchToTeam } from './lahman-franchises.ts'
import { normalizePlayerName } from './person-id.ts'
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
import { reliefWorkloadFromStats } from '../../src/lib/pitching-workload.ts'
import { STANDARD_RP_APPEARANCES } from '../../src/lib/calibration.ts'

function lahmanName(first: string, last: string): string {
  return decodeUnicodeEscapes(`${first} ${last}`.trim())
}

const __dirname = dirname(fileURLToPath(import.meta.url))
export const LAHMAN_DIR = join(__dirname, '../../data/lahman')

/** Both batting and pitching overall must meet this bar for purpose-made two-way cards. */
export const TWO_WAY_MIN_OVERALL = 60

type PersonRow = {
  playerID: string
  nameFirst: string
  nameLast: string
  bbrefID: string
}

export type Aggregated = {
  playerID: string
  personId: string
  name: string
  teamId: TeamId
  era: Era
  role: 'hitter' | 'pitcher' | 'two-way'
  positions: LineupPosition[]
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
  w: number
  sv: number
  g: number
  gs: number
  fieldingErrors: number
  fieldingGames: number
  valueScore: number
}

function yearToEra(year: number): Era | null {
  if (year < 1910 || year > 2029) return null
  const decade = Math.floor(year / 10) * 10
  const era = `${decade}s` as Era
  return ERAS.includes(era) ? era : null
}

function loadCsv(name: string): Record<string, string>[] {
  const path = join(LAHMAN_DIR, name)
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path}. Run: npm run fetch:lahman`,
    )
  }
  return parseCsv(readFileSync(path, 'utf8'))
}

function loadCsvOptional(name: string): Record<string, string>[] {
  const path = join(LAHMAN_DIR, name)
  if (!existsSync(path)) return []
  return parseCsv(readFileSync(path, 'utf8'))
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatAvg(h: number, ab: number): string {
  if (ab < 1) return '.250'
  const v = h / ab
  return v >= 1 ? '.999' : `.${Math.min(999, Math.round(v * 1000)).toString().padStart(3, '0')}`
}

function formatEra(er: number, ipOuts: number): string {
  if (ipOuts < 1) return '4.00'
  const ip = ipOuts / 3
  return (er * 9 / ip).toFixed(2)
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

function formatOps(h: number, ab: number, bb: number, doubles: number, triples: number, hr: number): string {
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

function computeOps(agg: Aggregated): number {
  const ab = agg.ab || 1
  const pa = ab + agg.bb
  const obp = pa > 0 ? (agg.h + agg.bb) / pa : 0
  const slg =
    (agg.h + agg.doubles + 2 * agg.triples + 3 * agg.hr) / ab
  return obp + slg
}

function ratingsFromAggBatting(agg: Aggregated): PlayerRatings {
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

function ratingsFromAggPitching(agg: Aggregated): PlayerRatings {
  const ip = agg.ipOuts / 3
  const eraVal = ip > 0 ? (agg.er * 9) / ip : 4.5
  const whipVal = ip > 0 ? (agg.hAllowed + agg.bbAllowed) / ip : 1.35
  const k9 = ip > 0 ? (agg.so * 9) / ip : 0
  const gs = Math.max(agg.gs, 1)
  const ipPer30Gs = (ip / gs) * 30
  const reliefGames = Math.max(0, agg.g - agg.gs)
  const isRelief = reliefProfileFromStats(agg.gs, agg.g, reliefGames)
  const savesPer70 =
    reliefGames > 0
      ? (agg.sv / reliefGames) * STANDARD_RP_APPEARANCES
      : 0

  const eraScore = scoreFromAnchors(eraVal, PITCHER_ERA_ANCHORS, {
    lowerIsBetter: true,
  })
  const whipScore = scoreFromAnchors(whipVal, PITCHER_WHIP_ANCHORS, {
    lowerIsBetter: true,
  })
  const kScore = scoreFromAnchors(k9, PITCHER_K9_ANCHORS)
  const workload = isRelief
    ? reliefWorkloadFromStats({
        gs: agg.gs,
        g: agg.g,
        reliefGames,
        ip,
      })
    : scoreFromAnchors(ipPer30Gs, PITCHER_IP_PER_30GS_ANCHORS)
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
      eraScore * 0.25 +
        whipScore * 0.2 +
        kScore * 0.2 +
        savesScore * 0.35,
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

  return pitcherRatings(
    eraScore,
    whipScore,
    kScore,
    wScore,
    workload,
    50,
  )
}

function positionsFromAppearance(row: Record<string, string>): LineupPosition[] {
  const map: [keyof typeof row, LineupPosition][] = [
    ['G_c', 'C'],
    ['G_1b', '1B'],
    ['G_2b', '2B'],
    ['G_3b', '3B'],
    ['G_ss', 'SS'],
    ['G_lf', 'LF'],
    ['G_cf', 'CF'],
    ['G_rf', 'RF'],
    ['G_p', 'SP'],
  ]
  const out: LineupPosition[] = []
  for (const [key, pos] of map) {
    if (num(row[key] ?? '0') >= 10) out.push(pos)
  }
  return out
}

function mergePositions(
  existing: LineupPosition[],
  added: LineupPosition[],
): LineupPosition[] {
  const set = new Set([...existing, ...added])
  const order: LineupPosition[] = [
    'SP', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF',
  ]
  return order.filter((p) => set.has(p))
}

function buildHitterStats(agg: Aggregated): HitterStats {
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
    g: agg.g > 0 ? agg.g : 162,
    errors: agg.fieldingErrors,
    fieldingGames: agg.fieldingGames > 0 ? agg.fieldingGames : undefined,
  }
}

function buildPitcherStats(agg: Aggregated): PitcherStats {
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

function hasDedicatedReliefProfile(agg: Aggregated): boolean {
  return isDedicatedReliefEligible({
    id: agg.personId,
    personId: agg.personId,
    name: agg.name,
    teamId: agg.teamId,
    teamName: '',
    era: agg.era,
    role: agg.role,
    positions: [],
    stats: buildPitcherStats(agg),
    ratings: pitcherRatings(0, 0, 0, 0, 0, 0),
  })
}

function finalizePositions(
  agg: Aggregated,
  positions: LineupPosition[],
): LineupPosition[] {
  const set = new Set(positions)
  if (agg.role === 'pitcher' || agg.role === 'two-way') {
    const gs = agg.gs > 0 ? agg.gs : Math.max(agg.g, 1)
    const g = Math.max(agg.g, gs)
    const reliefGames = Math.max(0, g - gs)
    const starter = starterProfileFromStats(gs, g, reliefGames)
    const reliever = reliefProfileFromStats(gs, g, reliefGames)
    if (starter) set.add('SP')
    if (reliever) set.add('RP')
    if (agg.role === 'pitcher' && !starter && !reliever) {
      set.add('SP')
    }
  }
  if (agg.role === 'hitter' || agg.role === 'two-way') {
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
  if (agg.role === 'pitcher') {
    const pitching = order.filter((p) => (p === 'SP' || p === 'RP') && set.has(p))
    return pitching.length > 0 ? pitching : ['SP']
  }
  return order.filter((p) => set.has(p))
}

function aggToPlayer(agg: Aggregated, teamName: string, rank: number): Player {
  const id = `${agg.personId}-${agg.teamId}-${agg.era}`
  const positions = finalizePositions(
    agg,
    agg.positions.length ? agg.positions : ['RF'],
  )

  if (agg.role === 'two-way') {
    const battingRatings = ratingsFromAggBatting(agg)
    const pitchingRatings = ratingsFromAggPitching(agg)
    const battingStats = buildHitterStats(agg)
    const pitchingStats = buildPitcherStats(agg)
    const primaryRole: 'hitter' | 'pitcher' =
      battingRatings.overall >= pitchingRatings.overall ? 'hitter' : 'pitcher'
    const overall = Math.round(
      battingRatings.overall * 0.55 + pitchingRatings.overall * 0.45,
    )
    const ratings: PlayerRatings = {
      ...battingRatings,
      era: pitchingRatings.era,
      whip: pitchingRatings.whip,
      strikeouts: pitchingRatings.strikeouts,
      wins: pitchingRatings.wins,
      workload: pitchingRatings.workload,
      overall,
    }
    return {
      id,
      personId: agg.personId,
      name: agg.name,
      teamId: agg.teamId,
      teamName,
      era: agg.era,
      role: 'two-way',
      positions,
      stats: primaryRole === 'hitter' ? battingStats : pitchingStats,
      battingStats,
      pitchingStats,
      ratings,
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

  if (agg.role === 'pitcher') {
    const ratings = ratingsFromAggPitching(agg)
    return {
      id,
      personId: agg.personId,
      name: agg.name,
      teamId: agg.teamId,
      teamName,
      era: agg.era,
      role: 'pitcher',
      positions,
      stats: buildPitcherStats(agg),
      ratings,
      pitchingRatings: ratings,
      bucketRank: rank,
    }
  }

  const ratings = ratingsFromAggBatting(agg)
  return {
    id,
    personId: agg.personId,
    name: agg.name,
    teamId: agg.teamId,
    teamName,
    era: agg.era,
    role: 'hitter',
    positions,
    stats: buildHitterStats(agg),
    ratings,
    battingRatings: ratings,
    bucketRank: rank,
  }
}

let bucketIndex: Map<string, Aggregated[]> | null = null

export function buildLahmanBucketIndex(): Map<string, Aggregated[]> {
  if (bucketIndex) return bucketIndex

  const peopleRows = loadCsv('People.csv')
  const people = new Map<string, PersonRow>()
  for (const row of peopleRows) {
    const playerID = row.playerID ?? ''
    if (!playerID) continue
    people.set(playerID, {
      playerID,
      nameFirst: row.nameFirst ?? '',
      nameLast: row.nameLast ?? '',
      bbrefID: row.bbrefID || playerID,
    })
  }

  const teamFranch = new Map<string, string>()
  for (const row of loadCsv('Teams.csv')) {
    const year = num(row.yearID ?? '0')
    const teamID = row.teamID ?? ''
    const franchID = row.franchID ?? ''
    if (year >= 1901 && teamID && franchID) {
      teamFranch.set(`${year}-${teamID}`, franchID)
    }
  }

  const index = new Map<string, Aggregated>()

  const touch = (
    playerID: string,
    year: number,
    teamID: string,
    updater: (agg: Aggregated) => void,
  ) => {
    const franchID = teamFranch.get(`${year}-${teamID}`)
    if (!franchID) return
    const teamId = lahmanFranchToTeam(franchID)
    if (!teamId) return
    const era = yearToEra(year)
    if (!era) return
    const person = people.get(playerID)
    if (!person) return

    const key = `${playerID}|${teamId}|${era}`
    let agg = index.get(key)
    if (!agg) {
      const name = lahmanName(person.nameFirst, person.nameLast)
      agg = {
        playerID,
        personId: person.bbrefID,
        name,
        teamId,
        era,
        role: 'hitter',
        positions: [],
        ab: 0,
        h: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        rbi: 0,
        sb: 0,
        bb: 0,
        hAllowed: 0,
        bbAllowed: 0,
        ipOuts: 0,
        er: 0,
        so: 0,
        w: 0,
        sv: 0,
        g: 0,
        gs: 0,
        fieldingErrors: 0,
        fieldingGames: 0,
        valueScore: 0,
      }
      index.set(key, agg)
    }
    updater(agg)
  }

  for (const row of loadCsv('Batting.csv')) {
    const year = num(row.yearID ?? '0')
    if (year < 1910) continue
    const lg = row.lgID ?? ''
    if (lg !== 'AL' && lg !== 'NL') continue
    touch(row.playerID ?? '', year, row.teamID ?? '', (agg) => {
      agg.ab += num(row.AB ?? '0')
      agg.h += num(row.H ?? '0')
      agg.doubles += num(row['2B'] ?? '0')
      agg.triples += num(row['3B'] ?? '0')
      agg.hr += num(row.HR ?? '0')
      agg.rbi += num(row.RBI ?? '0')
      agg.sb += num(row.SB ?? '0')
      agg.bb += num(row.BB ?? '0')
      agg.g += num(row.G ?? '0')
    })
  }

  for (const row of loadCsv('Pitching.csv')) {
    const year = num(row.yearID ?? '0')
    if (year < 1910) continue
    const lg = row.lgID ?? ''
    if (lg !== 'AL' && lg !== 'NL') continue
    touch(row.playerID ?? '', year, row.teamID ?? '', (agg) => {
      agg.ipOuts += num(row.IPouts ?? '0')
      agg.hAllowed += num(row.H ?? '0')
      agg.bbAllowed += num(row.BB ?? '0')
      agg.er += num(row.ER ?? '0')
      agg.so += num(row.SO ?? '0')
      agg.w += num(row.W ?? '0')
      agg.sv += num(row.SV ?? '0')
      agg.g += num(row.G ?? '0')
      agg.gs += num(row.GS ?? '0')
    })
  }

  for (const row of loadCsv('Appearances.csv')) {
    const year = num(row.yearID ?? '0')
    if (year < 1910) continue
    const lg = row.lgID ?? ''
    if (lg !== 'AL' && lg !== 'NL') continue
    touch(row.playerID ?? '', year, row.teamID ?? '', (agg) => {
      const pos = positionsFromAppearance(row)
      agg.positions = mergePositions(agg.positions, pos)
    })
  }

  for (const row of loadCsvOptional('Fielding.csv')) {
    const year = num(row.yearID ?? '0')
    if (year < 1910) continue
    const lg = row.lgID ?? ''
    if (lg !== 'AL' && lg !== 'NL') continue
    touch(row.playerID ?? '', year, row.teamID ?? '', (agg) => {
      agg.fieldingErrors += num(row.E ?? '0')
      agg.fieldingGames += num(row.G ?? '0')
    })
  }

  for (const agg of index.values()) {
    const ip = agg.ipOuts / 3
    const battingQualified = agg.ab >= 80
    const pitchingQualified = ip >= 40
    const isPurePitcher = ip >= 80 && ip >= agg.ab / 3

    if (battingQualified && pitchingQualified) {
      const batOverall = ratingsFromAggBatting(agg).overall
      const pitOverall = ratingsFromAggPitching(agg).overall
      const era = ip > 0 ? (agg.er * 9) / ip : 5
      const obp = (agg.h + agg.bb) / (agg.ab + agg.bb)
      const slg = (agg.h + agg.doubles + 2 * agg.triples + 3 * agg.hr) / agg.ab
      const opsNum = obp + slg

      if (
        batOverall >= TWO_WAY_MIN_OVERALL &&
        pitOverall >= TWO_WAY_MIN_OVERALL
      ) {
        agg.role = 'two-way'
        agg.valueScore =
          agg.hr * 2.2 +
          agg.rbi * 0.35 +
          agg.h * 0.15 +
          opsNum * 40 +
          agg.w * 2 +
          agg.so * 0.05 +
          Math.max(0, 6 - era) * 10
      } else if (isPurePitcher || pitOverall >= batOverall) {
        agg.role = 'pitcher'
        agg.valueScore = agg.w * 4 + agg.so * 0.08 + Math.max(0, 6 - era) * 15
        if (!agg.positions.includes('SP')) agg.positions = ['SP', ...agg.positions]
      } else {
        agg.role = 'hitter'
        agg.valueScore =
          agg.hr * 2.2 +
          agg.rbi * 0.35 +
          agg.h * 0.15 +
          agg.sb * 0.4 +
          opsNum * 40
      }
    } else if (isPurePitcher || (ip >= 80 && !battingQualified)) {
      agg.role = 'pitcher'
      const era = ip > 0 ? (agg.er * 9) / ip : 5
      const reliefGames = Math.max(0, agg.g - agg.gs)
      if (hasDedicatedReliefProfile(agg)) {
        const svPer70 =
          reliefGames > 0
            ? (agg.sv / reliefGames) * STANDARD_RP_APPEARANCES
            : 0
        agg.valueScore =
          agg.sv * 4 +
          svPer70 * 0.6 +
          agg.so * 0.06 +
          Math.max(0, 6 - era) * 12
      } else {
        agg.valueScore = agg.w * 4 + agg.so * 0.08 + Math.max(0, 6 - era) * 15
      }
      if (!agg.positions.includes('SP')) agg.positions = ['SP', ...agg.positions]
    } else if (battingQualified) {
      agg.role = 'hitter'
      const obp = (agg.h + agg.bb) / (agg.ab + agg.bb)
      const slg = (agg.h + agg.doubles + 2 * agg.triples + 3 * agg.hr) / agg.ab
      const opsNum = obp + slg
      agg.valueScore =
        agg.hr * 2.2 +
        agg.rbi * 0.35 +
        agg.h * 0.15 +
        agg.sb * 0.4 +
        opsNum * 40
    } else {
      agg.valueScore = -1
      continue
    }
    if (agg.positions.length === 0) {
      agg.positions =
        agg.role === 'pitcher' ? ['SP'] : agg.role === 'two-way' ? ['RF', 'SP'] : ['RF']
    }
  }

  const buckets = new Map<string, Aggregated[]>()
  for (const agg of index.values()) {
    if (agg.valueScore < 0) continue
    const bkey = `${agg.teamId}-${agg.era}`
    const list = buckets.get(bkey) ?? []
    list.push(agg)
    buckets.set(bkey, list)
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => b.valueScore - a.valueScore)
  }

  bucketIndex = buckets
  return buckets
}

export function getLahmanPlayerForBucket(
  franchiseId: TeamId,
  era: Era,
  teamDisplayName: string,
  personId: string,
  nameFallback?: string,
): Player | null {
  const buckets = buildLahmanBucketIndex()
  const list = buckets.get(`${franchiseId}-${era}`) ?? []

  let agg = list.find((entry) => entry.personId === personId)
  if (!agg && nameFallback) {
    const normalized = normalizePlayerName(nameFallback)
    agg = list.find((entry) => normalizePlayerName(entry.name) === normalized)
  }
  if (!agg) return null

  return aggToPlayer(agg, teamDisplayName, 0)
}

export function getLahmanPlayersForBucket(
  franchiseId: TeamId,
  era: Era,
  teamDisplayName: string,
  limit: number,
  excludePersonIds: Set<string>,
  predicate?: (player: Player) => boolean,
): Player[] {
  const buckets = buildLahmanBucketIndex()
  const list = buckets.get(`${franchiseId}-${era}`) ?? []
  const picked: Player[] = []
  for (const agg of list) {
    if (excludePersonIds.has(agg.personId)) continue
    const player = aggToPlayer(agg, teamDisplayName, picked.length + 1)
    if (predicate && !predicate(player)) continue
    picked.push(player)
    if (picked.length >= limit) break
  }
  return picked
}

export function lahmanDataAvailable(): boolean {
  return existsSync(join(LAHMAN_DIR, 'People.csv'))
}
