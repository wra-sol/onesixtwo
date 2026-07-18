import type { LivePlayer } from '@shared/live/live-types'

export type TeamOption = {
  abbrev: string
  name: string
  /** Total players from this team in the pool (ignores draft availability). */
  count: number
}

/**
 * Derive the unique teams present in a player pool, sorted by team name.
 * Used to drive the team picker that scopes every mode's draft browser.
 */
export function deriveTeamOptions(players: LivePlayer[]): TeamOption[] {
  const map = new Map<string, TeamOption>()
  for (const p of players) {
    const existing = map.get(p.teamAbbrev)
    if (existing) {
      existing.count += 1
    } else {
      map.set(p.teamAbbrev, { abbrev: p.teamAbbrev, name: p.teamName, count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
