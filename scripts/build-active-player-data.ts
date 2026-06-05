/**
 * Builds active-player draft pool from yesterday's MLB lineups + current-season stats.
 * Run: npm run build:active-data
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRANCHISES } from '../src/data/franchises.ts'
import { playerCoversLineupPosition } from '../src/lib/player-eligibility.ts'
import { BASE_LINEUP_POSITIONS } from '../src/lib/roster-format.ts'
import type { DraftBucket, Player, TeamId } from '../src/lib/types.ts'
import {
  ACTIVE_ERA,
  buildActivePlayerCard,
  personIdFromMlbId,
  type ActivePlayerInput,
} from './lib/active-player-builder.ts'
import {
  fetchBoxscore,
  fetchPersonSeasonStats,
  fetchScheduleForDate,
  fetchTeamRoster,
  formatDateYmd,
  isCompletedGame,
  yesterdayUtc,
  type MlbBoxscoreTeam,
  type MlbPersonWithStats,
} from './lib/mlb-stats-api.ts'
import { TEAM_TO_MLB_ID, teamIdFromMlbApi } from './lib/mlb-team-map.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../src/data/generated/active')
const MIN_BUCKET_PLAYERS = 2

type TeamPlayerSeed = {
  mlbPersonId: number
  name: string
  teamId: TeamId
  positionCodes: Set<string>
  person?: MlbPersonWithStats
}

function playerKeyInBox(team: MlbBoxscoreTeam, personId: number): string | null {
  for (const [key, entry] of Object.entries(team.players)) {
    if (entry.person.id === personId) return key
  }
  return null
}

function extractLineupPersonIds(team: MlbBoxscoreTeam): number[] {
  const ids = new Set<number>()
  for (const id of team.battingOrder ?? []) {
    ids.add(id)
  }
  for (const id of team.pitchers ?? []) {
    ids.add(id)
  }
  return [...ids]
}

function addTeamPlayer(
  map: Map<string, TeamPlayerSeed>,
  seed: Omit<TeamPlayerSeed, 'positionCodes'> & { positionCodes: string[] },
): void {
  const key = `${seed.teamId}:${seed.mlbPersonId}`
  const existing = map.get(key)
  if (!existing) {
    map.set(key, {
      ...seed,
      positionCodes: new Set(seed.positionCodes),
    })
    return
  }
  for (const code of seed.positionCodes) {
    existing.positionCodes.add(code)
  }
}

async function collectYesterdayPlayers(
  date: string,
  season: number,
): Promise<Map<string, TeamPlayerSeed & { person: MlbPersonWithStats }>> {
  const games = await fetchScheduleForDate(date)
  const completed = games.filter(isCompletedGame)
  const seeds = new Map<string, TeamPlayerSeed>()

  for (const game of completed) {
    const box = await fetchBoxscore(game.gamePk)

    for (const side of [box.teams.away, box.teams.home] as const) {
      const teamId = teamIdFromMlbApi(side.team.id)
      if (!teamId) continue

      for (const personId of extractLineupPersonIds(side)) {
        const playerKey = playerKeyInBox(side, personId)
        const entry = playerKey ? side.players[playerKey] : null
        const positionCode =
          entry?.position?.code ??
          entry?.position?.abbreviation ??
          '10'
        addTeamPlayer(seeds, {
          mlbPersonId: personId,
          name: entry?.person.fullName ?? `Player ${personId}`,
          teamId,
          positionCodes: [positionCode],
        })
      }
    }
  }

  if (seeds.size === 0) {
    console.warn(`No completed games found for ${date}; active pool will be empty.`)
    return seeds
  }

  const enriched = new Map<string, TeamPlayerSeed & { person: MlbPersonWithStats }>()
  const entries = [...seeds.values()]
  const batchSize = 8
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (seed) => {
        const person = await fetchPersonSeasonStats(seed.mlbPersonId, season)
        const primary =
          person.primaryPosition?.code ??
          person.primaryPosition?.abbreviation ??
          ''
        if (primary) seed.positionCodes.add(primary)
        enriched.set(`${seed.teamId}:${seed.mlbPersonId}`, {
          ...seed,
          name: person.fullName || seed.name,
          person,
        })
      }),
    )
  }

  return enriched
}

function buildBuckets(playersByTeam: Map<TeamId, Player[]>): DraftBucket[] {
  const buckets: DraftBucket[] = []
  for (const franchise of FRANCHISES) {
    const players = playersByTeam.get(franchise.id) ?? []
    if (players.length < MIN_BUCKET_PLAYERS) continue
    const sorted = [...players].sort(
      (a, b) => b.ratings.overall - a.ratings.overall,
    )
    buckets.push({
      id: `active-${franchise.id}`,
      teamId: franchise.id,
      teamName: sorted[0]?.teamName ?? franchise.name,
      era: ACTIVE_ERA,
      playerIds: sorted.map((player) => player.id),
    })
  }
  return buckets
}

function bucketMissingPositions(players: Player[]) {
  return BASE_LINEUP_POSITIONS.filter(
    (position) =>
      !players.some((player) => playerCoversLineupPosition(player, position)),
  )
}

async function supplementBucketCoverage(
  teamId: TeamId,
  players: Player[],
  season: number,
  knownPersonIds: Set<string>,
): Promise<Player[]> {
  const missing = bucketMissingPositions(players)
  if (missing.length === 0) return players

  const mlbTeamId = TEAM_TO_MLB_ID[teamId]
  if (!mlbTeamId) return players

  const roster = await fetchTeamRoster(mlbTeamId, season)
  const next = [...players]

  for (const position of missing) {
    for (const entry of roster) {
      const personId = personIdFromMlbId(entry.person.id)
      if (knownPersonIds.has(personId)) continue

      const person = await fetchPersonSeasonStats(entry.person.id, season)
      const card = buildActivePlayerCard(
        {
          personId,
          mlbPersonId: entry.person.id,
          name: entry.person.fullName,
          teamId,
          positionCodes: [
            entry.position?.code ?? entry.position?.abbreviation ?? '10',
          ],
          person,
        },
        next.length + 1,
      )
      if (!card) continue
      if (!playerCoversLineupPosition(card, position)) continue

      next.push(card)
      knownPersonIds.add(personId)
      break
    }
  }

  return next
}

async function main() {
  const targetDate = process.env.ACTIVE_DATE ?? formatDateYmd(yesterdayUtc())
  const season = Number.parseInt(
    process.env.ACTIVE_SEASON ?? targetDate.slice(0, 4),
    10,
  )

  console.log(`Building active player pool for ${targetDate} (season ${season})`)

  const seeds = await collectYesterdayPlayers(targetDate, season)
  const playersByTeam = new Map<TeamId, Player[]>()
  const allPlayers = new Map<string, Player>()

  const grouped = new Map<TeamId, ActivePlayerInput[]>()
  for (const seed of seeds.values()) {
    const list = grouped.get(seed.teamId) ?? []
    list.push({
      personId: personIdFromMlbId(seed.mlbPersonId),
      mlbPersonId: seed.mlbPersonId,
      name: seed.name,
      teamId: seed.teamId,
      positionCodes: [...seed.positionCodes],
      person: seed.person,
    })
    grouped.set(seed.teamId, list)
  }

  const knownPersonIds = new Set<string>()
  for (const [teamId, inputs] of grouped) {
    const ranked = inputs
      .map((input, index) => ({
        input,
        card: buildActivePlayerCard(input, index + 1),
      }))
      .filter((entry): entry is { input: ActivePlayerInput; card: Player } =>
        Boolean(entry.card),
      )
      .sort((a, b) => b.card.ratings.overall - a.card.ratings.overall)

    let players = ranked.map((entry, index) => ({
      ...entry.card,
      bucketRank: index + 1,
    }))
    for (const player of players) {
      knownPersonIds.add(player.personId)
    }
    players = await supplementBucketCoverage(teamId, players, season, knownPersonIds)
    if (players.length > 0) {
      playersByTeam.set(teamId, players)
      for (const player of players) {
        allPlayers.set(player.id, player)
        knownPersonIds.add(player.personId)
      }
    }
  }

  const buckets = buildBuckets(playersByTeam)
  const playersArr = [...allPlayers.values()]

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'players.json'), JSON.stringify(playersArr, null, 0))
  writeFileSync(join(outDir, 'buckets.json'), JSON.stringify(buckets, null, 0))
  writeFileSync(
    join(outDir, 'meta.json'),
    JSON.stringify(
      {
        sourceDate: targetDate,
        season,
        playerCount: playersArr.length,
        bucketCount: buckets.length,
      },
      null,
      2,
    ),
  )

  const thinBuckets = buckets.filter(
    (bucket) => bucket.playerIds.length < MIN_BUCKET_PLAYERS,
  )
  const missingCoverage = buckets.filter((bucket) => {
    const players = bucket.playerIds
      .map((id) => allPlayers.get(id))
      .filter((player): player is Player => Boolean(player))
    return bucketMissingPositions(players).length > 0
  })

  console.log(
    `Generated ${playersArr.length} active player cards across ${buckets.length} team buckets`,
  )
  if (thinBuckets.length > 0) {
    console.warn(`Buckets below minimum size: ${thinBuckets.length}`)
  }
  if (missingCoverage.length > 0) {
    console.warn(`Buckets missing position coverage: ${missingCoverage.length}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
