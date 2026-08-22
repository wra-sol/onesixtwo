/**
 * Leaderboard contract shared by the client and the Pages Functions.
 * Server code may import from here; the client never imports from
 * functions/.
 */
import type { RosterFormatId } from './types'

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all'

export type LeaderboardEntryRow = {
  initials: string
  wins: number
  losses: number
  teamScore: number
  isPerfectSeason: boolean
  rosterFormatId: RosterFormatId
  sharePath: string
  createdAt: number
}

export const INITIALS_PATTERN = /^[A-Z]{2,3}$/

export function normalizeInitials(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (!INITIALS_PATTERN.test(normalized)) return null
  return normalized
}
