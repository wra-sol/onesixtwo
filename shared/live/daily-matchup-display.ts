import type { DailyMatchupSnapshot } from './live-types'

export function formatDailyMatchupOpponentHeadline(
  snapshot: DailyMatchupSnapshot,
): string {
  if (!snapshot.available || !snapshot.opponent) {
    return snapshot.unavailableReason ?? 'Daily Matchup unavailable today'
  }

  return `Opponent: ${snapshot.opponent.teamName} · ${snapshot.opponentGameScore.runs} runs`
}

export function formatDailyMatchupSubtitle(
  snapshot: DailyMatchupSnapshot,
): string {
  if (!snapshot.available || !snapshot.opponent) {
    return snapshot.unavailableReason ?? ''
  }

  return `Target ${snapshot.targetDate} · Opponent ${snapshot.opponent.teamName} (${snapshot.opponentGameScore.runs} runs)`
}
