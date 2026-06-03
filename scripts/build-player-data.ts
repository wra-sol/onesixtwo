/**
 * Builds franchise-decade buckets with up to 20 ranked players each.
 * Run: npm run build:data
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FRANCHISES,
  MODERN_ERAS,
  eraIndex,
  franchiseDisplayName,
  isModernEra,
} from '../src/data/franchises.ts'
import { SEED_PLAYERS } from '../src/data/seed-players.ts'
import type { DraftBucket, Era, Player, TeamId } from '../src/lib/types.ts'
import {
  getLahmanPlayersForBucket,
  lahmanDataAvailable,
} from './lib/lahman.ts'

const TOP_N = 20
const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../src/data/generated')

const FRANCHISE_FIRST_ERA: Partial<Record<TeamId, Era>> = {
  'blue-jays': '1970s',
  rays: '1990s',
  marlins: '1990s',
  rockies: '1990s',
  diamondbacks: '2000s',
  nationals: '1960s',
  mariners: '1970s',
  brewers: '1970s',
  padres: '1960s',
  rangers: '1960s',
  astros: '1960s',
  angels: '1960s',
  mets: '1960s',
  royals: '1960s',
  twins: '1960s',
  guardians: '1960s',
}

function bucketScore(player: Player, franchiseId: TeamId, bucketEra: Era): number {
  if (player.teamId !== franchiseId) return -1
  if (!isModernEra(player.era)) return -1
  const dist = Math.abs(eraIndex(player.era) - eraIndex(bucketEra))
  if (dist > 1) return -1
  const eraBonus = dist === 0 ? 25 : 0
  return player.ratings.overall + eraBonus - dist * 6
}

function cardForBucket(
  seed: Player,
  franchiseId: TeamId,
  era: Era,
  rank: number,
): Player {
  const teamName = franchiseDisplayName(franchiseId, era)
  const id = `${seed.personId}-${franchiseId}-${era}`
  return {
    ...seed,
    id,
    teamId: franchiseId,
    teamName,
    era,
    bucketRank: rank,
  }
}

function buildBucket(franchiseId: TeamId, era: Era): { bucket: DraftBucket; players: Player[] } {
  const first = FRANCHISE_FIRST_ERA[franchiseId]
  if (first && eraIndex(era) < eraIndex(first)) {
    return {
      bucket: {
        id: `${franchiseId}-${era}`,
        teamId: franchiseId,
        teamName: franchiseDisplayName(franchiseId, era),
        era,
        playerIds: [],
      },
      players: [],
    }
  }

  const byPerson = new Map<string, { seed: Player; score: number }>()
  for (const seed of SEED_PLAYERS) {
    const score = bucketScore(seed, franchiseId, era)
    if (score < 0) continue
    const prev = byPerson.get(seed.personId)
    if (!prev || score > prev.score) {
      byPerson.set(seed.personId, { seed, score })
    }
  }

  let ranked = [...byPerson.values()].sort((a, b) => b.score - a.score)
  const teamName = franchiseDisplayName(franchiseId, era)
  const usedPerson = new Set(ranked.map((r) => r.seed.personId))

  if (ranked.length < TOP_N && lahmanDataAvailable()) {
    const need = TOP_N - ranked.length
    const lahman = getLahmanPlayersForBucket(
      franchiseId,
      era,
      teamName,
      need + 5,
      usedPerson,
    )
    for (const p of lahman) {
      if (ranked.length >= TOP_N) break
      if (usedPerson.has(p.personId)) continue
      usedPerson.add(p.personId)
      ranked.push({ seed: p, score: p.ratings.overall })
    }
  }

  ranked = ranked.slice(0, TOP_N)
  const players = ranked.map(({ seed }, i) => {
    const lahmanCardId = `${seed.personId}-${franchiseId}-${era}`
    if (seed.id === lahmanCardId) {
      return { ...seed, bucketRank: i + 1 }
    }
    return cardForBucket(seed, franchiseId, era, i + 1)
  })
  const playerIds = players.map((p) => p.id)

  return {
    bucket: {
      id: `${franchiseId}-${era}`,
      teamId: franchiseId,
      teamName: franchiseDisplayName(franchiseId, era),
      era,
      playerIds,
    },
    players,
  }
}

function main() {
  const allPlayers = new Map<string, Player>()
  const buckets: DraftBucket[] = []

  for (const franchise of FRANCHISES) {
    for (const era of MODERN_ERAS) {
      const { bucket, players } = buildBucket(franchise.id, era)
      if (players.length === 0) continue
      buckets.push(bucket)
      for (const p of players) {
        allPlayers.set(p.id, p)
      }
    }
  }

  mkdirSync(outDir, { recursive: true })
  const playersArr = [...allPlayers.values()]
  writeFileSync(join(outDir, 'players.json'), JSON.stringify(playersArr, null, 0))
  writeFileSync(join(outDir, 'buckets.json'), JSON.stringify(buckets, null, 0))

  const coverage = buckets.map((b) => ({
    id: b.id,
    count: b.playerIds.length,
    exception: b.playerIds.length < TOP_N,
  }))
  writeFileSync(join(outDir, 'coverage-report.json'), JSON.stringify(coverage, null, 2))

  console.log(`Generated ${playersArr.length} player cards across ${buckets.length} buckets`)
  const exceptions = coverage.filter((c) => c.exception).length
  console.log(`Buckets with fewer than ${TOP_N} players: ${exceptions}`)
}

main()
