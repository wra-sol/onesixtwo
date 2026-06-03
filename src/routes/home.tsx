import { useCallback, useEffect, useMemo, useState } from 'react'
import DraftHistory from '../components/DraftHistory'
import DraftPanel from '../components/DraftPanel'
import HowToPlay from '../components/HowToPlay'
import LineupGrid from '../components/LineupGrid'
import PlayerChoices from '../components/PlayerChoices'
import ResultScreen from '../components/ResultScreen'
import StuckDraft from '../components/StuckDraft'
import { DRAFT_BUCKETS, PLAYER_BY_ID } from '../data'
import {
  applySpin,
  assignPlayer,
  calculateSeasonResult,
  createInitialGameState,
  restartGame,
  selectPlayer,
  startGame,
} from '../lib/game'
import type { GameState } from '../lib/types'

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

export default function HomeRoute() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState)
  const [spinTick, setSpinTick] = useState(0)

  const spinPreview = useMemo(() => {
    if (DRAFT_BUCKETS.length === 0) return null
    return DRAFT_BUCKETS[spinTick % DRAFT_BUCKETS.length] ?? null
  }, [spinTick])

  useEffect(() => {
    if (gameState.status !== 'spinning') {
      return
    }
    // Reset reel when a new spin starts (round / draft state changed).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional spin reel reset
    setSpinTick(0)
    const tick = window.setInterval(() => {
      setSpinTick((t) => t + 1)
    }, SPIN_TICK_MS)
    const finish = window.setTimeout(() => {
      setGameState((current) => applySpin(current))
    }, SPIN_DURATION_MS)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(finish)
    }
  }, [gameState.status, gameState.round, gameState.draftedPersonIds.length])

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

  if (gameState.status === 'intro') {
    return <HowToPlay onStart={handleStart} />
  }

  if (gameState.status === 'stuck') {
    return <StuckDraft onRestart={handleRestart} />
  }

  if (gameState.status === 'complete' && seasonResult) {
    return (
      <ResultScreen
        result={seasonResult}
        lineup={gameState.lineup}
        onRestart={handleRestart}
      />
    )
  }

  return (
    <div className="game-layout">
      <div className="game-column game-column--draft">
        <DraftPanel
          round={gameState.round}
          bucket={gameState.currentBucket}
          statusLabel={statusLabel(gameState)}
          isSpinning={gameState.status === 'spinning'}
          spinPreview={spinPreview}
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
      <div className="game-column game-column--lineup">
        <LineupGrid
          lineup={gameState.lineup}
          selectedPlayer={selectedPlayer}
          onAssign={handleAssign}
        />
        {gameState.status === 'assigning' && selectedPlayer && (
          <p className="assign-hint">
            Tap a position to assign {selectedPlayer.name}.
          </p>
        )}
      </div>
    </div>
  )
}
