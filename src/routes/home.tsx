import { useCallback, useEffect, useMemo, useState } from 'react'
import DraftHistory from '../components/DraftHistory'
import DraftPanel from '../components/DraftPanel'
import HowToPlay from '../components/HowToPlay'
import LineupGrid from '../components/LineupGrid'
import PlayerChoices from '../components/PlayerChoices'
import ResultScreen from '../components/ResultScreen'
import StuckDraft from '../components/StuckDraft'
import { PLAYER_BY_ID } from '../data'
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

export default function HomeRoute() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState)

  useEffect(() => {
    if (gameState.status !== 'spinning') {
      return
    }
    const timer = window.setTimeout(() => {
      setGameState((current) => applySpin(current))
    }, 500)
    return () => window.clearTimeout(timer)
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
        />
        {(gameState.status === 'picking' || gameState.status === 'assigning') && (
          <PlayerChoices
            players={gameState.availablePlayers}
            gameState={gameState}
            selectedPlayerId={gameState.selectedPlayerId}
            onSelect={handleSelect}
          />
        )}
        {gameState.status === 'spinning' && (
          <p className="spinning-message" aria-live="polite">
            Spinning…
          </p>
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
