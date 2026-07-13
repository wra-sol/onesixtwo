import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dailyMatchupConfig } from '@/lib/daily-matchup-mode-config'
import { storageKey, saveDailyDraft, type PersistedDailyDraft } from '@/lib/live-draft-persistence'
import { buildFixtureDailyMatchupSnapshot } from '@shared/live/live-fixtures'
import {
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  getDailyMatchupDisabledReason,
} from '@shared/live/live-draft'
import { dailyLineupIsComplete } from '@shared/live/daily-roster'
import type { DailyMatchupDraftState, DailyMatchupSnapshot } from '@shared/live/live-types'
import { useLiveDraftSession, type LiveDraftSessionState } from './useLiveDraftSession'

function asDailyDraftState(
  state: LiveDraftSessionState | null | undefined,
): DailyMatchupDraftState {
  if (!state || state.mode !== 'daily-matchup') {
    throw new Error(`expected daily-matchup draft state, got ${state?.mode ?? 'null'}`)
  }
  return state
}

vi.mock('@/lib/live-api-client', () => ({
  fetchDailyMatchupSnapshot: vi.fn(),
  LiveSnapshotError: class LiveSnapshotError extends Error {
    fallback?: boolean
    constructor(message: string, fallback?: boolean) {
      super(message)
      this.name = 'LiveSnapshotError'
      this.fallback = fallback
    }
  },
}))

vi.mock('@/lib/text', () => ({
  normalizeForSearch: (text: string) => text.toLowerCase(),
}))

const { fetchDailyMatchupSnapshot } = await import('@/lib/live-api-client')

function fixtureSnapshot(overrides: Partial<DailyMatchupSnapshot> = {}): DailyMatchupSnapshot {
  return { ...buildFixtureDailyMatchupSnapshot('2026-06-25', '2026-06-24'), ...overrides }
}

function buildCompleteDraftState(snapshot: DailyMatchupSnapshot) {
  const initial = createDailyMatchupDraftState(
    snapshot.challengeDate,
    snapshot.targetDate,
    snapshot.opponent!,
  )
  let state = initial
  for (const player of snapshot.players) {
    if (dailyLineupIsComplete(state.lineup)) break
    if (getDailyMatchupDisabledReason(player, state)) continue
    state = draftDailyMatchupPlayer(state, player)
  }
  return state
}

describe('useLiveDraftSession — daily matchup', () => {
  beforeEach(() => {
    vi.mocked(fetchDailyMatchupSnapshot).mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('renders a fallback snapshot as playable (no error) and flags fallback', async () => {
    const snap = fixtureSnapshot({ fallback: true, error: 'MLB API down' })
    vi.mocked(fetchDailyMatchupSnapshot).mockResolvedValue(snap)
    const { result } = renderHook(() => useLiveDraftSession(dailyMatchupConfig))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.isFallback).toBe(true)
    expect(result.current.fallbackWarning).toBe('MLB API down')
    expect(result.current.draftState).not.toBeNull()
    expect(result.current.draftState!.mode).toBe('daily-matchup')
    expect(result.current.snapshot?.fallback).toBe(true)
  })

  it('restores an in-progress draft from localStorage on load', async () => {
    const snap = fixtureSnapshot()
    const complete = buildCompleteDraftState(snap)
    expect(dailyLineupIsComplete(complete.lineup)).toBe(true)

    const key = storageKey('daily-matchup', snap.challengeDate)
    saveDailyDraft(key, complete, null)
    const persisted = JSON.parse(window.localStorage.getItem(key)!) as PersistedDailyDraft
    expect(persisted.positionPlayerIds.C).toBeTruthy()

    vi.mocked(fetchDailyMatchupSnapshot).mockResolvedValue(snap)
    const { result } = renderHook(() => useLiveDraftSession(dailyMatchupConfig))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await waitFor(() =>
      expect(asDailyDraftState(result.current.draftState).lineup.C).not.toBeNull(),
    )

    const restored = asDailyDraftState(result.current.draftState)
    expect(restored.lineup.C).not.toBeNull()
    expect(restored.lineup.CL).not.toBeNull()
    expect(dailyLineupIsComplete(restored.lineup)).toBe(true)
    expect(restored.status).toBe('lineup')
    expect(restored.battingOrder).toHaveLength(9)
  })

  it('clears localStorage when the series is simulated', async () => {
    const snap = fixtureSnapshot()
    const complete = buildCompleteDraftState(snap)
    const key = storageKey('daily-matchup', snap.challengeDate)
    saveDailyDraft(key, complete, null)

    vi.mocked(fetchDailyMatchupSnapshot).mockResolvedValue(snap)
    const { result } = renderHook(() => useLiveDraftSession(dailyMatchupConfig))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await waitFor(() => expect(result.current.draftState?.status).toBe('lineup'))

    act(() => result.current.handleSimulate())

    await waitFor(() => expect(result.current.series).not.toBeNull())
    expect(window.localStorage.getItem(key)).toBeNull()
  })
})
