import {
  createEmptyRoster25,
  playerEligibleForRoster25Slot,
  roster25IsComplete,
  roster25OpenSlots,
  ROSTER25_POSITION_SLOTS,
  type Roster25,
  type Roster25Slot,
} from './roster25'
import type { LivePlayer } from './live-types'

export type Sim162DraftStatus = 'drafting' | 'complete' | 'stuck'

export type Sim162DraftState = {
  mode: 'sim162'
  pool: LivePlayer[]
  roster: Roster25
  draftedPlayerIds: string[]
  draftedTeamIds: number[]
  status: Sim162DraftStatus
  currentSlot: Roster25Slot | null
}

export const SIM162_TOTAL_PICKS = 25

export function createSim162DraftState(pool: LivePlayer[]): Sim162DraftState {
  const state: Sim162DraftState = {
    mode: 'sim162',
    pool,
    roster: createEmptyRoster25(),
    draftedPlayerIds: [],
    draftedTeamIds: [],
    status: 'drafting',
    currentSlot: ROSTER25_POSITION_SLOTS[0] ?? null,
  }
  return { ...state, status: computeStatus(state) }
}

function openSlotIsFillable(state: Sim162DraftState, slot: Roster25Slot): boolean {
  return state.pool.some(
    (player) =>
      !state.draftedPlayerIds.includes(player.id) &&
      !state.draftedTeamIds.includes(player.teamId) &&
      playerEligibleForRoster25Slot(player, slot),
  )
}

function computeStatus(state: Sim162DraftState): Sim162DraftStatus {
  if (roster25IsComplete(state.roster)) return 'complete'
  const open = roster25OpenSlots(state.roster)
  if (open.some((slot) => !openSlotIsFillable(state, slot))) return 'stuck'
  return 'drafting'
}

export function getSim162DisabledReason(
  player: LivePlayer,
  state: Sim162DraftState,
): string | null {
  if (state.status === 'complete') return 'Draft complete'
  if (state.draftedPlayerIds.includes(player.id)) return 'Already drafted'
  if (state.draftedTeamIds.includes(player.teamId)) return `${player.teamAbbrev} used`
  const open = roster25OpenSlots(state.roster)
  const hasEligibleOpenSlot = open.some((slot) =>
    playerEligibleForRoster25Slot(player, slot),
  )
  if (!hasEligibleOpenSlot) return 'No open positions'
  return null
}

export function assignSim162Player(
  state: Sim162DraftState,
  player: LivePlayer,
  slot: Roster25Slot,
): Sim162DraftState {
  if (state.status === 'complete') return state
  if (state.roster[slot] !== null) return state
  if (state.draftedPlayerIds.includes(player.id)) return state
  if (state.draftedTeamIds.includes(player.teamId)) return state
  if (!playerEligibleForRoster25Slot(player, slot)) return state

  const next: Sim162DraftState = {
    ...state,
    roster: { ...state.roster, [slot]: player },
    draftedPlayerIds: [...state.draftedPlayerIds, player.id],
    draftedTeamIds: [...state.draftedTeamIds, player.teamId],
  }
  next.status = computeStatus(next)
  next.currentSlot = roster25OpenSlots(next.roster)[0] ?? null
  return next
}

export function isSim162RosterComplete(state: Sim162DraftState): boolean {
  return roster25IsComplete(state.roster)
}

export function autoFillSuggest(
  state: Sim162DraftState,
): Array<{ slot: Roster25Slot; playerId: string }> {
  const open = roster25OpenSlots(state.roster)
  const usedPlayerIds = new Set(state.draftedPlayerIds)
  const usedTeamIds = new Set(state.draftedTeamIds)
  const suggestions: Array<{ slot: Roster25Slot; playerId: string }> = []

  for (const slot of open) {
    let best: LivePlayer | null = null
    for (const player of state.pool) {
      if (usedPlayerIds.has(player.id)) continue
      if (usedTeamIds.has(player.teamId)) continue
      if (!playerEligibleForRoster25Slot(player, slot)) continue
      if (!best || player.grades.overall > best.grades.overall) {
        best = player
      }
    }
    if (best) {
      suggestions.push({ slot, playerId: best.id })
      usedPlayerIds.add(best.id)
      usedTeamIds.add(best.teamId)
    }
  }
  return suggestions
}

export function autoFillRemaining(state: Sim162DraftState): Sim162DraftState {
  if (state.status === 'complete') return state
  const suggestions = autoFillSuggest(state)
  const byId = new Map(state.pool.map((player) => [player.id, player]))
  let next = state
  for (const { slot, playerId } of suggestions) {
    const player = byId.get(playerId)
    if (!player) continue
    if (next.status === 'complete') break
    next = assignSim162Player(next, player, slot)
  }
  if (next.status === 'drafting' && !roster25IsComplete(next.roster)) {
    next = { ...next, status: 'stuck' }
  }
  return next
}
