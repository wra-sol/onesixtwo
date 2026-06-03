import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Era,
  LineupPosition,
  Player,
  PlayerRatings,
  TeamId,
} from '../../src/lib/types.ts'
import { ERAS } from '../../src/data/franchises.ts'
import { decodeUnicodeEscapes } from '../../src/lib/text.ts'
import { parseCsv } from './parse-csv.ts'
import { lahmanFranchToTeam } from './lahman-franchises.ts'

function lahmanName(first: string, last: string): string {
  return decodeUnicodeEscapes(`${first} ${last}`.trim())
}

const __dirname = dirname(fileURLToPath(import.meta.url))
export const LAHMAN_DIR = join(__dirname, '../../data/lahman')

type PersonRow = {
  playerID: string
  nameFirst: string
  nameLast: string
  bbrefID: string
}

type Aggregated = {
  playerID: string
  personId: string
  name: string
  teamId: TeamId
  era: Era
  role: 'hitter' | 'pitcher'
  positions: LineupPosition[]
  ab: number
  h: number
  doubles: number
  triples: number
  hr: number
  rbi: number
  sb: number
  bb: number
  ipOuts: number
  er: number
  so: number
  w: number
  g: number
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
    ops * 0.35 +
      power * 0.25 +
      contact * 0.2 +
      speed * 0.1 +
      runProduction * 0.1,
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
): PlayerRatings {
  const overall = Math.round(
    era * 0.35 +
      whip * 0.25 +
      strikeouts * 0.2 +
      wins * 0.1 +
      workload * 0.1,
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
    workload,
    overall,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function ratingsFromAgg(agg: Aggregated): PlayerRatings {
  if (agg.role === 'pitcher') {
    const ip = agg.ipOuts / 3
    const eraVal = ip > 0 ? (agg.er * 9) / ip : 4.5
    const eraScore = clamp(Math.round(100 - eraVal * 12), 55, 95)
    const whipVal = ip > 0 ? (agg.h + agg.bb) / ip : 1.35
    const whipScore = clamp(Math.round(100 - whipVal * 28), 55, 95)
    const kScore = clamp(Math.round(agg.so / 40), 55, 98)
    const wScore = clamp(Math.round(agg.w * 2.2), 55, 92)
    const workload = clamp(Math.round(ip / 15), 55, 92)
    return pitcherRatings(eraScore, whipScore, kScore, wScore, workload)
  }

  const ab = agg.ab || 1
  const avg = agg.h / ab
  const contact = clamp(Math.round(avg * 280), 55, 98)
  const power = clamp(Math.round((agg.hr / ab) * 1200 + 50), 55, 98)
  const speed = clamp(Math.round((agg.sb / ab) * 800 + 55), 55, 95)
  const runProduction = clamp(Math.round((agg.rbi / ab) * 900 + 50), 55, 98)
  const opsEst = clamp(Math.round((agg.h + agg.bb) / (ab + agg.bb) * 200 + power * 0.3), 55, 98)
  return hitterRatings(contact, power, speed, runProduction, opsEst)
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
    ['G_p', 'P'],
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
    'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF',
  ]
  return order.filter((p) => set.has(p))
}

function aggToPlayer(agg: Aggregated, teamName: string, rank: number): Player {
  const ratings = ratingsFromAgg(agg)
  const id = `${agg.personId}-${agg.teamId}-${agg.era}`
  const base = {
    id,
    personId: agg.personId,
    name: agg.name,
    teamId: agg.teamId,
    teamName,
    era: agg.era,
    positions: agg.positions.length ? agg.positions : (['RF'] as LineupPosition[]),
    ratings,
    bucketRank: rank,
  }

  if (agg.role === 'pitcher') {
    return {
      ...base,
      role: 'pitcher',
      stats: {
        era: formatEra(agg.er, agg.ipOuts),
        whip: formatWhip(agg.h, agg.bb, agg.ipOuts),
        so: agg.so,
        wins: agg.w,
      },
    }
  }

  return {
    ...base,
    role: 'hitter',
    stats: {
      avg: formatAvg(agg.h, agg.ab),
      obp: formatObp(agg.h, agg.bb, agg.ab),
      slg: formatSlg(agg.h, agg.doubles, agg.triples, agg.hr, agg.ab),
      hr: agg.hr,
      rbi: agg.rbi,
      sb: agg.sb,
      ops: formatOps(agg.h, agg.ab, agg.bb, agg.doubles, agg.triples, agg.hr),
    },
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
        ipOuts: 0,
        er: 0,
        so: 0,
        w: 0,
        g: 0,
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
      agg.er += num(row.ER ?? '0')
      agg.so += num(row.SO ?? '0')
      agg.w += num(row.W ?? '0')
      agg.g += num(row.G ?? '0')
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

  for (const agg of index.values()) {
    const ip = agg.ipOuts / 3
    const isPitcher = ip >= 80 && ip >= agg.ab / 3
    agg.role = isPitcher ? 'pitcher' : 'hitter'
    if (agg.role === 'pitcher') {
      const era = ip > 0 ? (agg.er * 9) / ip : 5
      agg.valueScore = agg.w * 4 + agg.so * 0.08 + Math.max(0, 6 - era) * 15
      if (!agg.positions.includes('P')) agg.positions = ['P', ...agg.positions]
    } else {
      if (agg.ab < 80) {
        agg.valueScore = -1
        continue
      }
      const obp = (agg.h + agg.bb) / (agg.ab + agg.bb)
      const slg = (agg.h + agg.doubles + 2 * agg.triples + 3 * agg.hr) / agg.ab
      const opsNum = obp + slg
      agg.valueScore =
        agg.hr * 2.2 +
        agg.rbi * 0.35 +
        agg.h * 0.15 +
        agg.sb * 0.4 +
        opsNum * 40
    }
    if (agg.positions.length === 0) {
      agg.positions = agg.role === 'pitcher' ? ['P'] : ['RF']
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

export function getLahmanPlayersForBucket(
  franchiseId: TeamId,
  era: Era,
  teamDisplayName: string,
  limit: number,
  excludePersonIds: Set<string>,
): Player[] {
  const buckets = buildLahmanBucketIndex()
  const list = buckets.get(`${franchiseId}-${era}`) ?? []
  const picked: Player[] = []
  for (const agg of list) {
    if (excludePersonIds.has(agg.personId)) continue
    picked.push(aggToPlayer(agg, teamDisplayName, picked.length + 1))
    if (picked.length >= limit) break
  }
  return picked
}

export function lahmanDataAvailable(): boolean {
  return existsSync(join(LAHMAN_DIR, 'People.csv'))
}
