import type { LiveModeConfig } from '@/hooks/useLiveDraftSession'
import { fetchDailyMatchupSnapshot } from '@/lib/live-api-client'
import {
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  getDailyMatchupDisabledReason,
  heuristicAiBattingOrder,
  setDailyMatchupBattingOrder,
} from '@shared/live/live-draft'
import { createEmptyDailyLineup, type DailyLineupPosition } from '@shared/live/daily-roster'
import { playerStarCost } from '@shared/live/daily-star-budget'
import { buildSimTeam, simulateBestOfThree } from '@shared/live/pa-sim'
import type { LivePlayer } from '@shared/live/live-types'

export const dailyMatchupConfig: LiveModeConfig = {
  mode: 'daily-matchup',
  fetchSnapshot: fetchDailyMatchupSnapshot,
  initDraft: (snapshot) => {
    if (snapshot.kind !== 'daily-matchup' || !snapshot.available || !snapshot.opponent) {
      return null
    }
    return createDailyMatchupDraftState(
      snapshot.challengeDate,
      snapshot.targetDate,
      snapshot.opponent,
    )
  },
  onAssign: (state, player, position, snapshot) => {
    if (state.mode !== 'daily-matchup') return state
    const pool = snapshot.kind === 'daily-matchup' ? snapshot.players : []
    return draftDailyMatchupPlayer(state, player, position, pool)
  },
  getDisabledReason: (player, state, snapshot) => {
    if (state.mode !== 'daily-matchup') return 'Invalid state'
    const pool = snapshot.kind === 'daily-matchup' ? snapshot.players : []
    return getDailyMatchupDisabledReason(player, state, pool)
  },
  getPlayerBadge: (player, state) => {
    if (state.mode !== 'daily-matchup' || !state.salaryCapEnabled) return null
    return `★${playerStarCost(player)}`
  },
  buildSeries: (state, snapshot) => {
    if (state.mode !== 'daily-matchup' || snapshot.kind !== 'daily-matchup') {
      throw new Error('Invalid state')
    }
    const confirmed = setDailyMatchupBattingOrder(state, state.battingOrder)
    const opponentLineup = createEmptyDailyLineup()
    for (const [pos, player] of Object.entries(snapshot.opponent!.lineup)) {
      if (player) opponentLineup[pos as DailyLineupPosition] = player
    }
    const opponentOrder =
      snapshot.opponent!.battingOrder.length > 0
        ? snapshot.opponent!.battingOrder
        : heuristicAiBattingOrder(
            Object.values(snapshot.opponent!.lineup).filter(
              (p): p is LivePlayer => Boolean(p),
            ),
          )
    const userTeam = buildSimTeam('You', confirmed.lineup, confirmed.battingOrder, true)
    const opponentTeam = buildSimTeam(
      snapshot.opponent!.teamName,
      opponentLineup,
      opponentOrder,
      false,
    )
    return simulateBestOfThree(userTeam, opponentTeam, snapshot.simSeed)
  },
  opponentName: (snapshot) =>
    snapshot.kind === 'daily-matchup' && snapshot.opponent
      ? snapshot.opponent.teamName
      : 'Opponent',
}
