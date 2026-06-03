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
import { SEED_PLAYERS_BACKUP } from '../src/data/seed-players.backup.ts'
import { SEED_HINTS, type SeedHint } from '../src/data/seed-players.ts'
import type { DraftBucket, Era, Player, TeamId } from '../src/lib/types.ts'
import {
  getLahmanPlayerForBucket,
  getLahmanPlayersForBucket,
  lahmanDataAvailable,
} from './lib/lahman.ts'
import {
  canonicalPersonId,
  normalizePlayerName,
} from './lib/person-id.ts'

const TOP_N = 20
const DEFAULT_HINT_PRIORITY = 88
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

function personIdForHint(hint: SeedHint): string {
  return canonicalPersonId({
    personId: hint.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    name: hint.name,
  })
}

function hintScore(hint: SeedHint, franchiseId: TeamId, bucketEra: Era): number {
  if (hint.teamId !== franchiseId) return -1
  if (!isModernEra(hint.era)) return -1
  const dist = Math.abs(eraIndex(hint.era) - eraIndex(bucketEra))
  if (dist > 1) return -1
  const eraBonus = dist === 0 ? 25 : 0
  const base = hint.priority ?? DEFAULT_HINT_PRIORITY
  return base + eraBonus - dist * 6
}

function backupScore(player: Player, franchiseId: TeamId, bucketEra: Era): number {
  if (player.teamId !== franchiseId) return -1
  if (!isModernEra(player.era)) return -1
  const dist = Math.abs(eraIndex(player.era) - eraIndex(bucketEra))
  if (dist > 1) return -1
  const eraBonus = dist === 0 ? 25 : 0
  return player.ratings.overall + eraBonus - dist * 6
}

function findBackupSeed(
  hint: SeedHint,
  franchiseId: TeamId,
  bucketEra: Era,
): Player | null {
  const personId = personIdForHint(hint)
  let best: { seed: Player; score: number } | null = null
  for (const raw of SEED_PLAYERS_BACKUP) {
    const seed: Player = { ...raw, personId: canonicalPersonId(raw) }
    if (seed.personId !== personId) continue
    const score = backupScore(seed, franchiseId, bucketEra)
    if (score < 0) continue
    if (!best || score > best.score) {
      best = { seed, score }
    }
  }
  return best?.seed ?? null
}

function resolveSeedPlayer(
  hint: SeedHint,
  franchiseId: TeamId,
  era: Era,
  teamName: string,
): Player | null {
  const personId = personIdForHint(hint)
  if (lahmanDataAvailable()) {
    return getLahmanPlayerForBucket(
      franchiseId,
      era,
      teamName,
      personId,
      hint.name,
    )
  }
  return findBackupSeed(hint, franchiseId, era)
}

function dedupeRanked(
  ranked: { seed: Player; score: number }[],
): { seed: Player; score: number }[] {
  const seenPerson = new Set<string>()
  const seenName = new Set<string>()
  const out: { seed: Player; score: number }[] = []
  for (const entry of ranked) {
    const personId = entry.seed.personId
    const name = normalizePlayerName(entry.seed.name)
    if (seenPerson.has(personId) || seenName.has(name)) {
      continue
    }
    seenPerson.add(personId)
    seenName.add(name)
    out.push(entry)
  }
  return out
}

function finalizeBucketCard(
  player: Player,
  franchiseId: TeamId,
  era: Era,
  rank: number,
): Player {
  const teamName = franchiseDisplayName(franchiseId, era)
  const personId = canonicalPersonId(player)
  const cardId = `${personId}-${franchiseId}-${era}`
  return {
    ...player,
    id: cardId,
    personId,
    teamId: franchiseId,
    teamName,
    era,
    bucketRank: rank,
  }
}

export function buildBucket(franchiseId: TeamId, era: Era): { bucket: DraftBucket; players: Player[] } {
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
  const teamName = franchiseDisplayName(franchiseId, era)

  for (const hint of SEED_HINTS) {
    const score = hintScore(hint, franchiseId, era)
    if (score < 0) continue
    const player = resolveSeedPlayer(hint, franchiseId, era, teamName)
    if (!player) continue
    const personId = canonicalPersonId(player)
    const combinedScore = score + player.ratings.overall * 0.25
    const prev = byPerson.get(personId)
    if (!prev || combinedScore > prev.score) {
      byPerson.set(personId, { seed: player, score: combinedScore })
    }
  }

  let ranked = [...byPerson.values()].sort((a, b) => b.score - a.score)
  const usedPerson = new Set(ranked.map((r) => r.seed.personId))
  const usedName = new Set(
    ranked.map((r) => normalizePlayerName(r.seed.name)),
  )

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
      const name = normalizePlayerName(p.name)
      if (usedPerson.has(p.personId) || usedName.has(name)) continue
      usedPerson.add(p.personId)
      usedName.add(name)
      ranked.push({ seed: p, score: p.ratings.overall })
    }
  }

  ranked = dedupeRanked(ranked).slice(0, TOP_N)
  const players = ranked.map(({ seed }, i) =>
    finalizeBucketCard(seed, franchiseId, era, i + 1),
  )
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
