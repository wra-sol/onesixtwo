import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeForSearch } from '@/lib/text'
import { deriveTeamOptions, type TeamOption } from '@/lib/team-options'
import { fetchSim162Snapshot, type Sim162Pool } from '@/lib/sim162-snapshot'
import { challengeDate } from '@shared/live/live-dates'
import { heuristicAiBattingOrder } from '@shared/live/live-draft'
import {
  assignSim162Player,
  autoFillRemaining,
  createSim162DraftState,
  getSim162DisabledReason,
  isSim162RosterComplete,
  type Sim162DraftState,
} from '@shared/live/sim162-draft'
import {
  roster25BattingOrder,
  roster25Rotation,
  roster25ToSeed,
  type Roster25Slot,
} from '@shared/live/roster25'
import { buildSim162Season } from '@shared/live/sim162-season'
import type { Sim162SeasonResult } from '@shared/live/sim162-season'
import type { LivePlayer } from '@shared/live/live-types'
import type { Sim162Snapshot } from '@shared/live/sim162-snapshot'

export type { Sim162SeasonResult }

export type Sim162Session = {
  pool: Sim162Pool | null
  setPool: (pool: Sim162Pool) => void
  snapshot: Sim162Snapshot | null
  draftState: Sim162DraftState | null
  isLoading: boolean
  error: string | null
  selectedPlayer: LivePlayer | null
  search: string
  setSearch: (s: string) => void
  teamFilter: string
  setTeamFilter: (abbrev: string) => void
  teamOptions: TeamOption[]
  filteredPlayers: LivePlayer[]
  canSelect: boolean
  getDisabledReason: (player: LivePlayer) => string | null
  handleSelect: (player: LivePlayer) => void
  handleAssign: (slot: Roster25Slot) => void
  handleAutoFill: () => void
  isRosterComplete: boolean
  battingOrder: LivePlayer[]
  setBattingOrder: (order: LivePlayer[]) => void
  rotationOrder: LivePlayer[]
  setRotationOrder: (order: LivePlayer[]) => void
  isLineupPhase: boolean
  handleSimulate: () => void
  isSimulating: boolean
  seasonResult: Sim162SeasonResult | null
  retry: () => void
}

export function useSim162Session(initialPool?: Sim162Pool): Sim162Session {
  const [pool, setPoolState] = useState<Sim162Pool | null>(initialPool ?? null)
  const [snapshot, setSnapshot] = useState<Sim162Snapshot | null>(null)
  const [draftState, setDraftState] = useState<Sim162DraftState | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [battingOrder, setBattingOrderState] = useState<LivePlayer[]>([])
  const [rotationOrder, setRotationOrderState] = useState<LivePlayer[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [seasonResult, setSeasonResult] = useState<Sim162SeasonResult | null>(null)
  const ordersInitializedRef = useRef(false)

  const initializeOrders = useCallback((state: Sim162DraftState) => {
    setBattingOrderState(
      heuristicAiBattingOrder(roster25BattingOrder(state.roster)),
    )
    setRotationOrderState(roster25Rotation(state.roster))
  }, [])

  const loadSnapshot = useCallback(async (selectedPool: Sim162Pool) => {
    setIsLoading(true)
    setError(null)
    setSnapshot(null)
    setDraftState(null)
    setSeasonResult(null)
    setSelectedPlayerId(null)
    setTeamFilter('')
    setBattingOrderState([])
    setRotationOrderState([])
    ordersInitializedRef.current = false
    try {
      const data = await fetchSim162Snapshot(selectedPool, challengeDate())
      setSnapshot(data)
      setDraftState(createSim162DraftState(data.players))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pool) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load snapshot when pool changes
    void loadSnapshot(pool)
  }, [pool, loadSnapshot])

  const setPool = useCallback((nextPool: Sim162Pool) => {
    setPoolState(nextPool)
  }, [])

  const playersById = useMemo(() => {
    const map = new Map<string, LivePlayer>()
    snapshot?.players.forEach((p) => map.set(p.id, p))
    return map
  }, [snapshot])

  const teamOptions = useMemo(
    () => (snapshot ? deriveTeamOptions(snapshot.players) : []),
    [snapshot],
  )

  // Derived (not stored in an effect): fall back to the first team whenever the
  // explicit selection is empty or no longer in the pool.
  const effectiveTeamFilter =
    teamFilter && teamOptions.some((t) => t.abbrev === teamFilter)
      ? teamFilter
      : (teamOptions[0]?.abbrev ?? '')

  const filteredPlayers = useMemo(() => {
    if (!snapshot || !draftState) return []
    const q = normalizeForSearch(search.trim())
    // A name search escapes the team scope so any player is findable; with no
    // search the browser always shows a single team's players.
    const base = q
      ? snapshot.players.filter((p) => normalizeForSearch(p.name).includes(q))
      : snapshot.players.filter((p) => p.teamAbbrev === effectiveTeamFilter)
    return [...base].sort((a, b) => b.grades.overall - a.grades.overall)
  }, [snapshot, draftState, search, effectiveTeamFilter])

  const firstAvailableTeam = useCallback(
    (state: Sim162DraftState, players: LivePlayer[], startAbbrev: string): string => {
      const hasAvailable = (abbrev: string) =>
        players.some(
          (p) => p.teamAbbrev === abbrev && !getSim162DisabledReason(p, state),
        )
      if (startAbbrev && hasAvailable(startAbbrev)) return startAbbrev
      const next = deriveTeamOptions(players).find((t) => hasAvailable(t.abbrev))
      return next ? next.abbrev : startAbbrev
    },
    [],
  )

  const selectedPlayer = selectedPlayerId
    ? (playersById.get(selectedPlayerId) ?? null)
    : null

  const isRosterComplete = draftState ? isSim162RosterComplete(draftState) : false
  const isLineupPhase = isRosterComplete && !seasonResult
  const canSelect = draftState !== null && draftState.status === 'drafting'

  const getDisabledReason = useCallback(
    (player: LivePlayer): string | null => {
      if (!draftState) return 'No draft in progress'
      return getSim162DisabledReason(player, draftState)
    },
    [draftState],
  )

  const handleSelect = useCallback(
    (player: LivePlayer) => {
      if (!draftState || !canSelect) return
      const reason = getSim162DisabledReason(player, draftState)
      if (reason) return
      setSelectedPlayerId(player.id)
    },
    [canSelect, draftState],
  )

  const handleAssign = useCallback(
    (slot: Roster25Slot) => {
      if (!draftState || !selectedPlayer) return
      const next = assignSim162Player(draftState, selectedPlayer, slot)
      setDraftState(next)
      setSelectedPlayerId(null)
      // Team-lock means the just-used team has no more legal picks; advance the
      // picker to the next team that still has an available player.
      setTeamFilter(
        firstAvailableTeam(next, snapshot?.players ?? [], effectiveTeamFilter),
      )
      if (isSim162RosterComplete(next) && !ordersInitializedRef.current) {
        ordersInitializedRef.current = true
        initializeOrders(next)
      }
    },
    [
      draftState,
      selectedPlayer,
      initializeOrders,
      firstAvailableTeam,
      snapshot,
      effectiveTeamFilter,
    ],
  )

  const handleAutoFill = useCallback(() => {
    if (!draftState) return
    const next = autoFillRemaining(draftState)
    setDraftState(next)
    setSelectedPlayerId(null)
    if (isSim162RosterComplete(next) && !ordersInitializedRef.current) {
      ordersInitializedRef.current = true
      initializeOrders(next)
    }
  }, [draftState, initializeOrders])

  const handleSimulate = useCallback(() => {
    if (!draftState || !snapshot || isSimulating) return
    setIsSimulating(true)
    const seasonSeed = `${roster25ToSeed(draftState.roster)}::${snapshot.simSeed}`
    window.setTimeout(() => {
      const result = buildSim162Season(
        draftState.roster,
        battingOrder,
        rotationOrder,
        snapshot,
        seasonSeed,
      )
      setSeasonResult(result)
      setIsSimulating(false)
    }, 50)
  }, [draftState, snapshot, isSimulating, battingOrder, rotationOrder])

  const retry = useCallback(() => {
    if (pool) {
      void loadSnapshot(pool)
    }
  }, [pool, loadSnapshot])

  return {
    pool,
    setPool,
    snapshot,
    draftState,
    isLoading,
    error,
    selectedPlayer,
    search,
    setSearch,
    teamFilter: effectiveTeamFilter,
    setTeamFilter,
    teamOptions,
    filteredPlayers,
    canSelect,
    getDisabledReason,
    handleSelect,
    handleAssign,
    handleAutoFill,
    isRosterComplete,
    battingOrder,
    setBattingOrder: setBattingOrderState,
    rotationOrder,
    setRotationOrder: setRotationOrderState,
    isLineupPhase,
    handleSimulate,
    isSimulating,
    seasonResult,
    retry,
  }
}
