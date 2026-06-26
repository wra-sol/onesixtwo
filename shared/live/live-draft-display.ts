import { dailyLineupOpenPositions, dailyLineupIsComplete } from './daily-roster'
import { snakeDraftSide } from './live-draft-snake'
import type { LiveDraftSnapshot, LiveDraftState } from './live-types'

export function formatLiveDraftHomeHeadline(snapshot: LiveDraftSnapshot): string {
  const count = snapshot.players.length.toLocaleString()
  return `${count} active MLB players · ${snapshot.challengeDate}`
}

export function formatLiveDraftHomeDescription(snapshot: LiveDraftSnapshot): string {
  const firstPick = snapshot.coinFlipUserFirst ? 'You pick first' : 'AI picks first'
  return `${firstPick} · Team-by-team snake draft · Best-of-3 sim`
}

const LATE_CATCHER_SCARCITY_ROUND = 9

export function liveDraftScarcityHint(state: LiveDraftState): string | null {
  if (state.status !== 'drafting') return null
  const open = dailyLineupOpenPositions(state.userLineup)
  if (state.round >= LATE_CATCHER_SCARCITY_ROUND && open.includes('C')) {
    return 'Catcher depth is scarce in late rounds'
  }
  return null
}

export function liveDraftPlayerListMessage(state: LiveDraftState): string | null {
  if (state.mode !== 'live-draft' || state.status !== 'drafting') {
    return null
  }

  if (state.roundStatus === 'spinning') {
    return `Round ${state.round}: spinning an MLB team…`
  }

  if (state.roundStatus !== 'picking' || dailyLineupIsComplete(state.userLineup)) {
    return "AI is drafting from this round's team…"
  }

  if (snakeDraftSide(state.currentPick, state.userPicksFirst) !== 'user') {
    return "AI is drafting from this round's team…"
  }

  const team = state.currentTeam?.teamAbbrev ?? 'this team'
  const open = dailyLineupOpenPositions(state.userLineup)
  const needs = open.length > 0 ? ` · Slots left: ${open.join(', ')}` : ''
  const scarcity = liveDraftScarcityHint(state)
  const scarcitySuffix = scarcity ? ` · ${scarcity}` : ''

  return `Pick one player from ${team}${needs}${scarcitySuffix}`
}
