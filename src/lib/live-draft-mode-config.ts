import type { LiveModeConfig } from '@/hooks/useLiveDraftSession'
import { fetchLiveDraftSnapshot } from '@/lib/live-api-client'
import {
  advanceLiveDraftAfterPick,
  createLiveDraftState,
  draftLiveUserPlayer,
  getLiveDraftUserDisabledReason,
  isUserTurn,
  setLiveDraftBattingOrder,
  snakeDraftSide,
} from '@shared/live/live-draft'
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
  const next = advanceLiveDraftAfterPick(state, players, simSeed)
  const newPick = next.picks[next.picks.length - 1]
  if (newPick && newPick.side === 'ai' && next.picks.length > before) {
    const player = players.find((p) => p.id === newPick.playerId)
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
      let state = createLiveDraftState(snapshot)
      if (!snapshot.coinFlipUserFirst) {
        state = runAiTurns(state, snapshot.players, snapshot.simSeed, onAiReveal)
      }
      return state
    },
    canSelectPlayer: (state) => state.mode === 'live-draft' && isUserTurn(state),
    onAssign: (state, player, position, snapshot) => {
      if (state.mode !== 'live-draft' || snapshot.kind !== 'live-draft') return state
      let next = draftLiveUserPlayer(
        state,
        player,
        snapshot.players,
        snapshot.simSeed,
        position,
      )
      if (
        next.currentPick <= 24 &&
        snakeDraftSide(next.currentPick, next.userPicksFirst) === 'ai'
      ) {
        next = runAiTurns(next, snapshot.players, snapshot.simSeed, onAiReveal)
      }
      return next
    },
    getDisabledReason: (player, state) => {
      if (state.mode !== 'live-draft') return 'Invalid state'
      if (!isUserTurn(state)) return 'Wait for your pick'
      return getLiveDraftUserDisabledReason(player, state)
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
