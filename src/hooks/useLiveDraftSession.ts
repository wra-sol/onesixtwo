import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeForSearch } from '@/lib/text'
import { LiveSnapshotError } from '@/lib/live-api-client'
import {
  clearDraft,
  loadDailyDraft,
  rehydrateDailyDraft,
  saveDailyDraft,
  storageKey,
} from '@/lib/live-draft-persistence'
import type {
  DailyMatchupDraftState,
  DailyMatchupSnapshot,
  LiveDraftSnapshot,
  LiveDraftState,
  LiveModeId,
  LivePlayer,
  LiveSnapshot,
  SimulatedSeries,
} from '@shared/live/live-types'
import type { DailyLineup, DailyLineupPosition } from '@shared/live/daily-roster'
import { indexPlayersById } from '@shared/live/players-index'

export type LiveDraftSessionState = DailyMatchupDraftState | LiveDraftState

export type LiveModeConfig = {
  mode: LiveModeId
  fetchSnapshot: () => Promise<LiveSnapshot>
  initDraft: (snapshot: LiveSnapshot) => LiveDraftSessionState | null
  onAssign: (
    state: LiveDraftSessionState,
    player: LivePlayer,
    position: DailyLineupPosition,
    snapshot: LiveSnapshot,
  ) => LiveDraftSessionState
  getDisabledReason: (
    player: LivePlayer,
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => string | null
  getPlayerBadge?: (
    player: LivePlayer,
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => string | null
  canSelectPlayer?: (
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => boolean
  getRoundPool?: (
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => LivePlayer[]
  getPlayerListMessage?: (
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => string | null
  onUserReroll?: (
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => LiveDraftSessionState
  buildSeries: (
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => SimulatedSeries
  opponentName: (snapshot: LiveSnapshot) => string
}

export function useLiveDraftSession(config: LiveModeConfig) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null)
  const [draftState, setDraftState] = useState<LiveDraftSessionState | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [series, setSeries] = useState<SimulatedSeries | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const persistenceKeyRef = useRef<string | null>(null)

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setIsFallback(false)
    setFallbackWarning(null)
    setSeries(null)
    setSelectedPlayerId(null)
    try {
      const data = await config.fetchSnapshot()
      setSnapshot(data)
      setIsFallback(Boolean(data.fallback))
      setFallbackWarning(data.fallback ? data.error ?? 'Sample data — live MLB unavailable.' : null)
      const initial = config.initDraft(data)
      const key = storageKey(config.mode, data.challengeDate)
      persistenceKeyRef.current = key
      let restored = initial
      let restoredSelectedId: string | null = null
      if (initial?.mode === 'daily-matchup') {
        const poolById = new Map<string, LivePlayer>(data.players.map((p) => [p.id, p]))
        const saved = loadDailyDraft(key)
        if (saved) {
          const rehydrated = rehydrateDailyDraft(saved, initial, poolById)
          if (rehydrated) {
            restored = rehydrated
            restoredSelectedId =
              saved.selectedPlayerId && poolById.has(saved.selectedPlayerId)
                ? saved.selectedPlayerId
                : null
          } else {
            clearDraft(key)
          }
        }
      }
      setDraftState(restored)
      setSelectedPlayerId(restoredSelectedId)
    } catch (err) {
      setSnapshot(null)
      setDraftState(null)
      if (err instanceof LiveSnapshotError) {
        setError(err.message)
        setIsFallback(err.fallback === true)
      } else {
        setError(err instanceof Error ? err.message : 'Load failed')
      }
    } finally {
      setIsLoading(false)
    }
  }, [config])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    void loadSnapshot()
  }, [loadSnapshot])

  const playersById = useMemo(
    () => indexPlayersById(snapshot?.players ?? []),
    [snapshot],
  )

  const persistenceKey = useMemo(() => {
    if (!snapshot) return null
    return storageKey(config.mode, snapshot.challengeDate)
  }, [config.mode, snapshot])

  // Persist the in-progress daily draft whenever it changes.
  useEffect(() => {
    if (!draftState || !persistenceKey) return
    if (draftState.mode !== 'daily-matchup') return
    if (series) return
    saveDailyDraft(persistenceKey, draftState, selectedPlayerId)
  }, [draftState, persistenceKey, selectedPlayerId, series])

  const filteredPlayers = useMemo(() => {
    if (!snapshot || !draftState) return []
    const q = normalizeForSearch(search.trim())
    const pool = config.getRoundPool?.(draftState, snapshot) ?? snapshot.players
    return pool
      .filter((p) => !q || normalizeForSearch(p.name).includes(q))
      .sort((a, b) => b.grades.overall - a.grades.overall)
  }, [config, draftState, snapshot, search])

  const selectedPlayer = selectedPlayerId
    ? playersById.get(selectedPlayerId) ?? null
    : null

  const canSelect =
    draftState && snapshot
      ? (config.canSelectPlayer?.(draftState, snapshot) ?? true)
      : false

  const handleSelect = useCallback(
    (player: LivePlayer) => {
      if (!draftState || !snapshot || !canSelect) return
      const reason = config.getDisabledReason(player, draftState, snapshot)
      if (reason) return
      setSelectedPlayerId(player.id)
    },
    [canSelect, config, draftState, snapshot],
  )

  const handleAssign = useCallback(
    (position: DailyLineupPosition) => {
      if (!draftState || !snapshot || !selectedPlayer) return
      const next = config.onAssign(draftState, selectedPlayer, position, snapshot)
      setDraftState(next)
      setSelectedPlayerId(null)
    },
    [config, draftState, selectedPlayer, snapshot],
  )

  const handleSimulate = useCallback(() => {
    if (!draftState || !snapshot) return
    if (persistenceKeyRef.current) clearDraft(persistenceKeyRef.current)
    setSeries(config.buildSeries(draftState, snapshot))
  }, [config, draftState, snapshot])

  const handleBattingOrderChange = useCallback(
    (order: LivePlayer[]) => {
      if (!draftState) return
      if (draftState.mode === 'live-draft') {
        setDraftState({ ...draftState, userBattingOrder: order })
      } else {
        setDraftState({ ...draftState, battingOrder: order })
      }
    },
    [draftState],
  )

  const userLineup = useMemo((): DailyLineup | null => {
    if (!draftState) return null
    return draftState.mode === 'live-draft' ? draftState.userLineup : draftState.lineup
  }, [draftState])

  const userBattingOrderIds = useMemo(() => {
    if (!draftState) return []
    const order =
      draftState.mode === 'live-draft'
        ? draftState.userBattingOrder
        : draftState.battingOrder
    return order.map((p) => p.id)
  }, [draftState])

  const aiLineup =
    draftState?.mode === 'live-draft' ? draftState.aiLineup : undefined

  const handleUserReroll = useCallback(() => {
    if (!draftState || !snapshot || !config.onUserReroll) return
    setDraftState(config.onUserReroll(draftState, snapshot))
    setSelectedPlayerId(null)
  }, [config, draftState, snapshot])

  const handleToggleSalaryCap = useCallback(
    (enabled: boolean) => {
      if (!draftState || draftState.mode !== 'daily-matchup') return
      // Locking the rule in only before the first pick keeps the draft fair.
      if (draftState.draftedPlayerIds.length > 0) return
      setDraftState({ ...draftState, salaryCapEnabled: enabled })
    },
    [draftState],
  )

  const isStuck = draftState?.mode === 'live-draft' && draftState.status === 'stuck'
  const isLineupPhase = draftState?.status === 'lineup'
  const isAssigning = selectedPlayer !== null

  const dailyMatchupSnapshot =
    snapshot?.kind === 'daily-matchup' ? snapshot : null
  const liveDraftSnapshot =
    snapshot?.kind === 'live-draft' ? snapshot : null

  const playerListMessage =
    draftState && snapshot
      ? (config.getPlayerListMessage?.(draftState, snapshot) ?? null)
      : null

  return {
    snapshot,
    dailyMatchupSnapshot,
    liveDraftSnapshot,
    draftState,
    selectedPlayer,
    selectedPlayerId,
    search,
    setSearch,
    series,
    error,
    isFallback,
    fallbackWarning,
    isLoading,
    playersById,
    filteredPlayers,
    playerListMessage,
    canSelect,
    isLineupPhase,
    isAssigning,
    userLineup,
    userBattingOrderIds,
    aiLineup,
    handleSelect,
    handleAssign,
    handleSimulate,
    handleBattingOrderChange,
    handleUserReroll,
    handleToggleSalaryCap,
    isStuck,
    retry: loadSnapshot,
    opponentName: snapshot ? config.opponentName(snapshot) : 'Opponent',
    getDisabledReason: (player: LivePlayer) =>
      draftState && snapshot
        ? config.getDisabledReason(player, draftState, snapshot)
        : null,
    getPlayerBadge: (player: LivePlayer) =>
      draftState && snapshot
        ? config.getPlayerBadge?.(player, draftState, snapshot) ?? null
        : null,
  }
}

export type { DailyMatchupSnapshot, LiveDraftSnapshot }
