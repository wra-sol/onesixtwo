import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DraftHistory from '../components/DraftHistory'
import DraftPanel from '../components/DraftPanel'
import HowToPlay from '../components/HowToPlay'
import LineupGrid from '../components/LineupGrid'
import PlayerChoices from '../components/PlayerChoices'
import ResultScreen from '../components/ResultScreen'
import StuckDraft from '../components/StuckDraft'
import { DRAFT_BUCKETS, PLAYER_BY_ID } from '../data'
import { MODERN_ERAS } from '../data/franchises'
import {
  assignPlayer,
  calculateSeasonResult,
  canRespinTeam,
  canRespinYear,
  createInitialGameState,
  requestTeamRespin,
  requestYearRespin,
  resolveSpin,
  restartGame,
  selectPlayer,
  startGame,
} from '../lib/game'
import { useReducedMotion } from '../lib/use-reduced-motion'
import type { Era, GameState } from '../lib/types'

function statusLabel(state: GameState): string {
  switch (state.status) {
    case 'intro':
      return 'Ready to draft'
    case 'spinning':
      return 'Spinning team and era…'
    case 'picking':
      return 'Choose a player'
    case 'assigning':
      return 'Assign to a lineup position'
    case 'complete':
      return 'Lineup complete'
    case 'stuck':
      return 'Draft blocked'
    default:
      return ''
  }
}

const SPIN_DURATION_MS = 900
const SPIN_TICK_MS = 70

const TEAM_REEL = [...new Set(DRAFT_BUCKETS.map((bucket) => bucket.teamName))].sort(
  (a, b) => a.localeCompare(b),
)

const ERA_REEL: Era[] = MODERN_ERAS

export default function HomeRoute() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState)
  const [teamSpinTick, setTeamSpinTick] = useState(0)
  const [eraSpinTick, setEraSpinTick] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const draftScrollRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLElement>(null)

  const spinDurationMs = prefersReducedMotion ? 0 : SPIN_DURATION_MS
  const spinTickMs = prefersReducedMotion ? 0 : SPIN_TICK_MS

  const teamPreview = useMemo(() => {
    if (TEAM_REEL.length === 0) return ''
    return TEAM_REEL[teamSpinTick % TEAM_REEL.length] ?? ''
  }, [teamSpinTick])

  const eraPreview = useMemo(() => {
    if (ERA_REEL.length === 0) return '1960s' as Era
    return ERA_REEL[eraSpinTick % ERA_REEL.length] ?? '1960s'
  }, [eraSpinTick])

  const spinResultAnnouncement = useMemo(() => {
    if (gameState.status !== 'picking' || !gameState.currentBucket) {
      return ''
    }
    return `Spin result: ${gameState.currentBucket.teamName}, ${gameState.currentBucket.era}`
  }, [gameState.status, gameState.currentBucket])

  useEffect(() => {
    const dock = dockRef.current
    const scroll = draftScrollRef.current
    if (!dock || !scroll) return

    const syncDockHeight = () => {
      scroll.style.setProperty('--lineup-dock-h', `${dock.offsetHeight}px`)
    }

    syncDockHeight()
    const ro = new ResizeObserver(syncDockHeight)
    ro.observe(dock)
    return () => ro.disconnect()
  }, [gameState.status, gameState.selectedPlayerId])

  useEffect(() => {
    if (gameState.status === 'assigning' && dockRef.current) {
      dockRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [gameState.status, gameState.selectedPlayerId])

  useEffect(() => {
    if (gameState.status !== 'spinning') {
      return
    }

    const spinTeam =
      gameState.spinIntent === 'round' || gameState.spinIntent === 'team'
    const spinEra =
      gameState.spinIntent === 'round' || gameState.spinIntent === 'year'

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional spin reel reset
    setTeamSpinTick(0)
    setEraSpinTick(0)

    if (spinDurationMs === 0) {
      setGameState((current) => resolveSpin(current))
      return
    }

    const tick = window.setInterval(() => {
      if (spinTeam) {
        setTeamSpinTick((t) => t + 1)
      }
      if (spinEra) {
        setEraSpinTick((t) => t + 1)
      }
    }, spinTickMs)

    const finish = window.setTimeout(() => {
      setGameState((current) => resolveSpin(current))
    }, spinDurationMs)

    return () => {
      window.clearInterval(tick)
      window.clearTimeout(finish)
    }
  }, [
    gameState.status,
    gameState.round,
    gameState.draftedPersonIds.length,
    gameState.spinIntent,
    spinDurationMs,
    spinTickMs,
  ])

  const selectedPlayer = useMemo(() => {
    if (!gameState.selectedPlayerId) {
      return null
    }
    return PLAYER_BY_ID.get(gameState.selectedPlayerId) ?? null
  }, [gameState.selectedPlayerId])

  const seasonResult = useMemo(() => {
    if (gameState.status !== 'complete') {
      return null
    }
    return calculateSeasonResult(gameState.lineup)
  }, [gameState.status, gameState.lineup])

  const handleStart = useCallback(() => {
    setGameState((s) => startGame(s))
  }, [])

  const handleSelect = useCallback((playerId: string) => {
    setGameState((s) => selectPlayer(s, playerId))
  }, [])

  const handleAssign = useCallback((position: Parameters<typeof assignPlayer>[1]) => {
    setGameState((s) => assignPlayer(s, position))
  }, [])

  const handleRestart = useCallback(() => {
    setGameState(restartGame())
  }, [])

  const handleRespinTeam = useCallback(() => {
    setGameState((s) => requestTeamRespin(s))
  }, [])

  const handleRespinYear = useCallback(() => {
    setGameState((s) => requestYearRespin(s))
  }, [])

  if (gameState.status === 'intro') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  if (gameState.status === 'stuck') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <StuckDraft onRestart={handleRestart} />
      </div>
    )
  }

  if (gameState.status === 'complete' && seasonResult) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ResultScreen
          result={seasonResult}
          lineup={gameState.lineup}
          onRestart={handleRestart}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-visible md:grid md:grid-cols-2 md:items-start md:gap-6">
      <div
        ref={draftScrollRef}
        className="draft-scroll min-h-0 flex-1 space-y-4 overflow-y-auto md:overflow-visible md:pb-0"
      >
        <DraftPanel
          round={gameState.round}
          bucket={gameState.currentBucket}
          statusLabel={statusLabel(gameState)}
          isSpinning={gameState.status === 'spinning'}
          spinIntent={gameState.spinIntent}
          teamPreview={teamPreview}
          eraPreview={eraPreview}
          spinResultAnnouncement={spinResultAnnouncement}
          canRespinTeam={canRespinTeam(gameState)}
          canRespinYear={canRespinYear(gameState)}
          teamRespinUsed={gameState.teamRespinUsed}
          yearRespinUsed={gameState.yearRespinUsed}
          onRespinTeam={
            gameState.status === 'picking' ? handleRespinTeam : undefined
          }
          onRespinYear={
            gameState.status === 'picking' ? handleRespinYear : undefined
          }
        />
        {(gameState.status === 'picking' || gameState.status === 'assigning') && (
          <PlayerChoices
            players={gameState.availablePlayers}
            gameState={gameState}
            selectedPlayerId={gameState.selectedPlayerId}
            onSelect={handleSelect}
          />
        )}
        <DraftHistory history={gameState.history} />
      </div>
      <aside
        ref={dockRef}
        className="lineup-aside absolute bottom-0 left-0 z-50 w-full md:static md:z-auto md:w-auto"
      >
        <LineupGrid
          lineup={gameState.lineup}
          selectedPlayer={selectedPlayer}
          isAssigning={gameState.status === 'assigning'}
          onAssign={handleAssign}
        />
        {gameState.status === 'assigning' && selectedPlayer && (
          <p className="hidden px-4 pb-2 text-sm text-muted-foreground md:block">
            Tap a position to assign {selectedPlayer.name}.
          </p>
        )}
      </aside>
    </div>
  )
}
