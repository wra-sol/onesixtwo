import type { LiveModeConfig } from '@/hooks/useLiveDraftSession'
import { fetchLiveDraftSnapshot } from '@/lib/live-api-client'
import {
  advanceLiveDraftTurns,
  applyUserReroll,
  draftLiveUserPlayer,
  filterRoundPool,
  getLiveDraftUserDisabledReason,
  isUserTurn,
  requestUserReroll,
  setLiveDraftBattingOrder,
  startLiveDraft,
} from '@shared/live/live-draft'
import { liveDraftPlayerListMessage } from '@shared/live/live-draft-display'
import { buildSimTeam, simulateBestOfThree } from '@shared/live/pa-sim'
import type { LiveDraftState, LivePlayer } from '@shared/live/live-types'

const AI_REVEAL_MS = 600

function runAiTurns(
  state: LiveDraftState,
  players: LivePlayer[],
  simSeed: string,
  onReveal: (player: LivePlayer | null) => void,
): LiveDraftState {
  const before = state.picks.length
  let next = state
  while (
    next.status === 'drafting' &&
    (next.roundStatus === 'spinning' ||
      (next.roundStatus === 'picking' && !isUserTurn(next)))
  ) {
    next = advanceLiveDraftTurns(next, players, simSeed)
  }
  const newAiPicks = next.picks.slice(before).filter((pick) => pick.side === 'ai')
  if (newAiPicks.length > 0) {
    const latest = newAiPicks[newAiPicks.length - 1]!
    const player = players.find((p) => p.id === latest.playerId)
    if (player) {
      onReveal(player)
      window.setTimeout(() => onReveal(null), AI_REVEAL_MS)
    }
  }
  return next
}

export function buildLiveDraftConfig(
  onAiReveal: (player: LivePlayer | null) => void,
): LiveModeConfig {
  return {
    mode: 'live-draft',
    fetchSnapshot: fetchLiveDraftSnapshot,
    initDraft: (snapshot) => {
      if (snapshot.kind !== 'live-draft') return null
      const state = startLiveDraft(snapshot)
      return runAiTurns(state, snapshot.players, snapshot.simSeed, onAiReveal)
    },
    canSelectPlayer: (state, snapshot) =>
      state.mode === 'live-draft' &&
      isUserTurn(state) &&
      snapshot.kind === 'live-draft',
    getRoundPool: (state, snapshot) => {
      if (state.mode !== 'live-draft' || snapshot.kind !== 'live-draft') return []
      return filterRoundPool(snapshot.players, state, 'user')
    },
    getPlayerListMessage: (state, snapshot) => {
      if (state.mode !== 'live-draft' || snapshot.kind !== 'live-draft') return null
      return liveDraftPlayerListMessage(state)
    },
    onUserReroll: (state, snapshot) => {
      if (state.mode !== 'live-draft' || snapshot.kind !== 'live-draft') return state
      const requested = requestUserReroll(state)
      return runAiTurns(
        applyUserReroll(requested, snapshot.players, snapshot.simSeed),
        snapshot.players,
        snapshot.simSeed,
        onAiReveal,
      )
    },
    onAssign: (state, player, position, snapshot) => {
      if (state.mode !== 'live-draft' || snapshot.kind !== 'live-draft') return state
      const next = draftLiveUserPlayer(
        state,
        player,
        snapshot.players,
        snapshot.simSeed,
        position,
      )
      return runAiTurns(next, snapshot.players, snapshot.simSeed, onAiReveal)
    },
    getDisabledReason: (player, state, snapshot) => {
      if (state.mode !== 'live-draft' || snapshot.kind !== 'live-draft') {
        return 'Invalid state'
      }
      return getLiveDraftUserDisabledReason(player, state, snapshot.players)
    },
    buildSeries: (state, snapshot) => {
      if (state.mode !== 'live-draft' || snapshot.kind !== 'live-draft') {
        throw new Error('Invalid state')
      }
      const confirmed = setLiveDraftBattingOrder(state, state.userBattingOrder)
      const userTeam = buildSimTeam(
        'You',
        confirmed.userLineup,
        confirmed.userBattingOrder,
        true,
      )
      const opponentTeam = buildSimTeam(
        'AI',
        confirmed.aiLineup,
        confirmed.aiBattingOrder,
        false,
      )
      return simulateBestOfThree(userTeam, opponentTeam, snapshot.simSeed)
    },
    opponentName: () => 'AI',
  }
}
