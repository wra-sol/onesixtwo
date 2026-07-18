import {
  DAILY_LINEUP_POSITIONS,
  createEmptyDailyLineup,
  dailyLineupIsComplete,
  type DailyLineup,
  type DailyLineupPosition,
} from '@shared/live/daily-roster'
import type {
  DailyMatchupDraftState,
  LivePlayer,
} from '@shared/live/live-types'

export type PersistedDailyDraft = {
  challengeDate: string
  positionPlayerIds: Record<DailyLineupPosition, string | null>
  battingOrderIds: string[]
  selectedPlayerId: string | null
  status: DailyMatchupDraftState['status']
  salaryCapEnabled?: boolean
}

export function storageKey(mode: string, challengeDate: string): string {
  return `onesixtwo:${mode}:${challengeDate}`
}

export function saveDailyDraft(
  key: string,
  state: DailyMatchupDraftState,
  selectedPlayerId: string | null,
): void {
  if (state.mode !== 'daily-matchup') return
  const positionPlayerIds = {} as Record<DailyLineupPosition, string | null>
  for (const pos of DAILY_LINEUP_POSITIONS) {
    positionPlayerIds[pos] = state.lineup[pos]?.id ?? null
  }
  const persisted: PersistedDailyDraft = {
    challengeDate: state.challengeDate,
    positionPlayerIds,
    battingOrderIds: state.battingOrder.map((p) => p.id),
    selectedPlayerId,
    status: state.status,
    salaryCapEnabled: state.salaryCapEnabled,
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(persisted))
  } catch {
    // storage unavailable or full — non-fatal; draft stays in-memory
  }
}

export function loadDailyDraft(key: string): PersistedDailyDraft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as PersistedDailyDraft
  } catch {
    return null
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // non-fatal
  }
}

export function rehydrateDailyDraft(
  saved: PersistedDailyDraft,
  fresh: DailyMatchupDraftState,
  playersById: Map<string, LivePlayer>,
): DailyMatchupDraftState | null {
  if (saved.challengeDate !== fresh.challengeDate) return null

  const lineup = createEmptyDailyLineup() as DailyLineup
  const draftedPlayerIds: string[] = []
  const draftedTeamIds: number[] = []
  for (const pos of DAILY_LINEUP_POSITIONS) {
    const id = saved.positionPlayerIds[pos]
    if (!id) continue
    const player = playersById.get(id)
    if (!player) return null
    lineup[pos] = player
    draftedPlayerIds.push(player.id)
    draftedTeamIds.push(player.teamId)
  }

  const battingOrder: LivePlayer[] = []
  for (const id of saved.battingOrderIds) {
    const player = playersById.get(id)
    if (!player) return null
    battingOrder.push(player)
  }

  const complete = dailyLineupIsComplete(lineup)
  const status: DailyMatchupDraftState['status'] =
    saved.status === 'lineup' && complete
      ? 'lineup'
      : saved.status === 'complete' && complete
        ? 'complete'
        : 'drafting'

  return {
    ...fresh,
    lineup,
    battingOrder: status === 'drafting' ? [] : battingOrder,
    draftedPlayerIds,
    draftedTeamIds,
    status,
    salaryCapEnabled: saved.salaryCapEnabled ?? fresh.salaryCapEnabled,
  }
}
