import type { LiveDraftSnapshot } from '../../../shared/live/live-types'
import { mapRawPlayersToLive } from '../../../shared/live/live-mlb-mapper'
import { seededCoinFlip } from '../../../shared/live/rng'
import { mapWithConcurrency, seasonFromDate, type SeasonStatsCache } from './mlb-client'
import type { MlbDataSource } from './mlb-source'
import { buildRawFromRoster, ROSTER_CONCURRENCY } from './player-pool'
import { liveDraftSnapshotSeed } from '../../../shared/live/seeds'

export async function buildLiveDraftSnapshot(
  challengeDate: string,
  source: MlbDataSource,
): Promise<LiveDraftSnapshot> {
  const season = seasonFromDate(challengeDate)
  const teams = await source.allTeams(season)
  const statsCache: SeasonStatsCache = new Map()

  const rosterChunks = await mapWithConcurrency(
    teams.teams,
    ROSTER_CONCURRENCY,
    async (team) =>
      buildRawFromRoster({
        source,
        teamId: team.id,
        teamAbbrev: team.abbreviation,
        teamName: team.name,
        season,
        statsCache,
      }),
  )
  const rawPlayers = rosterChunks.flat()
  const players = mapRawPlayersToLive(rawPlayers)
  const coinFlipUserFirst = seededCoinFlip(challengeDate)

  return {
    kind: 'live-draft',
    challengeDate,
    players,
    coinFlipUserFirst,
    simSeed: liveDraftSnapshotSeed(challengeDate),
  }
}
