/**
 * Validates generated player data. Run: npm run validate:data
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isDedicatedReliefEligible,
  isStarterEligible,
} from '../src/lib/player-eligibility.ts'
import { LINEUP_POSITIONS } from '../src/lib/types.ts'
import { validateModeDataset } from '../src/data/modes.ts'
import type { DraftBucket, Player } from '../src/lib/types.ts'
import { BUCKET_MIN } from './lib/bucket-size.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const genDir = join(__dirname, '../src/data/generated')
const activeDir = join(genDir, 'active')
const MIN_BUCKET = 2
const MIN_BUCKET_SP = 2
const MIN_BUCKET_RP = 2

function main() {
  const players = JSON.parse(
    readFileSync(join(genDir, 'players.json'), 'utf8'),
  ) as Player[]
  const buckets = JSON.parse(
    readFileSync(join(genDir, 'buckets.json'), 'utf8'),
  ) as DraftBucket[]

  const errors: string[] = []
  const playerById = new Map(players.map((p) => [p.id, p]))

  for (const bucket of buckets) {
    const resolved = bucket.playerIds.map((id) => playerById.get(id))
    if (resolved.some((p) => !p)) {
      errors.push(`Bucket ${bucket.id} references missing player ids`)
    }
    if (bucket.playerIds.length < MIN_BUCKET) {
      errors.push(`Bucket ${bucket.id} has only ${bucket.playerIds.length} players`)
    }
    const starters = resolved.filter((p) => p && isStarterEligible(p)).length
    const relievers = resolved.filter((p) => p && isDedicatedReliefEligible(p)).length
    if (starters < MIN_BUCKET_SP) {
      errors.push(
        `Bucket ${bucket.id} has only ${starters} starter-profile pitchers (need ${MIN_BUCKET_SP})`,
      )
    }
    if (relievers < MIN_BUCKET_RP) {
      errors.push(
        `Bucket ${bucket.id} has only ${relievers} dedicated reliever-profile pitchers (need ${MIN_BUCKET_RP})`,
      )
    }
    const personIds = resolved.map((p) => p?.personId).filter(Boolean)
    const uniquePersonIds = new Set(personIds)
    if (personIds.length !== uniquePersonIds.size) {
      errors.push(`Bucket ${bucket.id} has duplicate personId entries`)
    }
    const names = resolved.map((p) => p?.name).filter(Boolean)
    const uniqueNames = new Set(names)
    if (names.length !== uniqueNames.size) {
      errors.push(`Bucket ${bucket.id} has duplicate player names`)
    }
  }

  for (const p of players) {
    if (!p.personId) errors.push(`Player ${p.id} missing personId`)
    if (!p.positions?.length) errors.push(`Player ${p.id} missing positions`)
    for (const [key, value] of Object.entries(p.ratings)) {
      if (key === 'war') continue
      if (typeof value === 'number' && (value < 0 || value > 100)) {
        errors.push(`Player ${p.id} rating ${key} out of range: ${value}`)
      }
    }
    if (p.role === 'hitter') {
      const stats = p.stats as import('../src/lib/types.ts').HitterStats
      if (stats.errors != null && stats.errors < 0) {
        errors.push(`Player ${p.id} has negative errors`)
      }
    }
  }

  const globalPositions = new Set(players.flatMap((p) => p.positions))
  for (const pos of LINEUP_POSITIONS) {
    if (!globalPositions.has(pos)) {
      errors.push(`Global dataset missing position: ${pos}`)
    }
  }

  const underTarget = buckets.filter((b) => b.playerIds.length < BUCKET_MIN).length
  console.log(`Buckets: ${buckets.length}, Players: ${players.length}`)
  console.log(`Buckets under ${BUCKET_MIN} players: ${underTarget}`)

  const activeErrors = validateModeDataset('active')
  const activePlayers = JSON.parse(
    readFileSync(join(activeDir, 'players.json'), 'utf8'),
  ) as Player[]
  const activeBuckets = JSON.parse(
    readFileSync(join(activeDir, 'buckets.json'), 'utf8'),
  ) as DraftBucket[]
  console.log(
    `Active buckets: ${activeBuckets.length}, Active players: ${activePlayers.length}`,
  )
  errors.push(...activeErrors)

  if (errors.length) {
    console.error('Validation failed:')
    errors.forEach((e) => console.error(`  - ${e}`))
    process.exit(1)
  }
  console.log('Validation passed.')
}

main()
