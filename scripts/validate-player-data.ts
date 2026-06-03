/**
 * Validates generated player data. Run: npm run validate:data
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINEUP_POSITIONS } from '../src/lib/types.ts'
import type { DraftBucket, Player } from '../src/lib/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const genDir = join(__dirname, '../src/data/generated')
const MIN_BUCKET = 2
const TARGET_BUCKET = 20

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
    const positions = new Set(resolved.flatMap((p) => p?.positions ?? []))
    if (!positions.has('P') && !resolved.some((p) => p?.role === 'pitcher')) {
      errors.push(`Bucket ${bucket.id} has no pitcher`)
    }
    const personIds = resolved.map((p) => p?.personId).filter(Boolean)
    const uniquePersonIds = new Set(personIds)
    if (personIds.length !== uniquePersonIds.size) {
      errors.push(`Bucket ${bucket.id} has duplicate personId entries`)
    }
  }

  for (const p of players) {
    if (!p.personId) errors.push(`Player ${p.id} missing personId`)
    if (!p.positions?.length) errors.push(`Player ${p.id} missing positions`)
  }

  const globalPositions = new Set(players.flatMap((p) => p.positions))
  for (const pos of LINEUP_POSITIONS) {
    if (!globalPositions.has(pos)) {
      errors.push(`Global dataset missing position: ${pos}`)
    }
  }

  const underTarget = buckets.filter((b) => b.playerIds.length < TARGET_BUCKET).length
  console.log(`Buckets: ${buckets.length}, Players: ${players.length}`)
  console.log(`Buckets under ${TARGET_BUCKET} players: ${underTarget}`)

  if (errors.length) {
    console.error('Validation failed:')
    errors.forEach((e) => console.error(`  - ${e}`))
    process.exit(1)
  }
  console.log('Validation passed.')
}

main()
