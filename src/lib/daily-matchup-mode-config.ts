import type { LiveModeConfig } from '@/hooks/useLiveDraftSession'
import { fetchDailyMatchupSnapshot } from '@/lib/live-api-client'
import {
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  getDailyMatchupDisabledReason,
  setDailyMatchupBattingOrder,
} from '@shared/live/live-draft'
import { playerStarCost } from '@shared/live/daily-star-budget'
import {
  resolveLiveShareOpponent,
  simulateLineupSeries,
} from '@shared/live/live-share-sim'

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
    const opponent = resolveLiveShareOpponent(snapshot, { mode: 'daily-matchup' })
    if (!opponent) {
      throw new Error('Daily Matchup is unavailable today.')
    }
    return simulateLineupSeries(
      {
        name: 'You',
        lineup: confirmed.lineup,
        battingOrder: confirmed.battingOrder,
      },
      opponent,
      snapshot.simSeed,
    )
  },
  opponentName: (snapshot) =>
    snapshot.kind === 'daily-matchup' && snapshot.opponent
      ? snapshot.opponent.teamName
      : 'Opponent',
}
