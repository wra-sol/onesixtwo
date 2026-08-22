import { roster25ToSeed, type Roster25 } from './roster25'

/**
 * Owns every seed-format construction in the game. Seed strings are the
 * determinism contract behind share links and stored leaderboard rows: a
 * drifted template doesn't crash, it silently replays a different season.
 * Never build these with template literals at call sites.
 */

/**
 * Season seed for a Sim 162 run: the drafted-roster encoding tied to the
 * snapshot's simulation seed. Same roster + seed → identical season.
 */
export function sim162SeasonSeed(roster: Roster25, simSeed: string): string {
  return `${roster25ToSeed(roster)}::${simSeed}`
}

/**
 * One Sim 162 regular-season game (162-game grind).
 */
export function regularSeasonGameSeed(
  seasonSeed: string,
  gameIndex: number,
): string {
  return `${seasonSeed}|reg${gameIndex}`
}

/**
 * One game of a Sim 162 playoff series (RosterSimTeam sides).
 */
export function rosterSeriesGameSeed(seriesSeed: string, index: number): string {
  return `${seriesSeed}|g${index}`
}

/**
 * One game of a Daily Matchup / Live Draft best-of-3 (DailyLineup sides).
 * Suffix must stay stable — stored leaderboard rows re-sim from these seeds.
 */
export function lineupSeriesGameSeed(seriesSeed: string, index: number): string {
  return `${seriesSeed}|game${index}`
}

/**
 * Snapshot seeds identify the player pool a challenge date was built from.
 */
export function dailyMatchupSnapshotSeed(
  challengeDate: string,
  targetDate: string,
  opponentTeamId: number,
): string {
  return `${challengeDate}|${targetDate}|${opponentTeamId}`
}

export function liveDraftSnapshotSeed(challengeDate: string): string {
  return `${challengeDate}|live-draft`
}

export function sim162LiveSnapshotSeed(challengeDate: string): string {
  return `${challengeDate}|sim162-live`
}

export function unavailableDailySnapshotSeed(challengeDate: string): string {
  return `${challengeDate}|unavailable`
}

export function erroredDailySnapshotSeed(challengeDate: string): string {
  return `${challengeDate}|error`
}
