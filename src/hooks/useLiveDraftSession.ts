import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeForSearch } from '@/lib/text'
import { LiveSnapshotError } from '@/lib/live-api-client'
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
  canSelectPlayer?: (
    state: LiveDraftSessionState,
    snapshot: LiveSnapshot,
  ) => boolean
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
  const [isLoading, setIsLoading] = useState(true)

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setIsFallback(false)
    setSeries(null)
    setSelectedPlayerId(null)
    try {
      const data = await config.fetchSnapshot()
      setSnapshot(data)
      setDraftState(config.initDraft(data))
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

  const playersById = useMemo(() => {
    const map = new Map<string, LivePlayer>()
    snapshot?.players.forEach((p) => map.set(p.id, p))
    return map
  }, [snapshot])

  const filteredPlayers = useMemo(() => {
    if (!snapshot) return []
    const q = normalizeForSearch(search.trim())
    return snapshot.players
      .filter((p) => !q || normalizeForSearch(p.name).includes(q))
      .sort((a, b) => b.grades.overall - a.grades.overall)
  }, [snapshot, search])

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

  const isLineupPhase = draftState?.status === 'lineup'
  const isAssigning = selectedPlayer !== null

  const dailyMatchupSnapshot =
    snapshot?.kind === 'daily-matchup' ? snapshot : null
  const liveDraftSnapshot =
    snapshot?.kind === 'live-draft' ? snapshot : null

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
    isLoading,
    playersById,
    filteredPlayers,
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
    retry: loadSnapshot,
    opponentName: snapshot ? config.opponentName(snapshot) : 'Opponent',
    getDisabledReason: (player: LivePlayer) =>
      draftState && snapshot
        ? config.getDisabledReason(player, draftState, snapshot)
        : null,
  }
}

export type { DailyMatchupSnapshot, LiveDraftSnapshot }
