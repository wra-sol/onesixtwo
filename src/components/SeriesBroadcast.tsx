import { useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { SimulatedSeries } from '@shared/live/live-types'
import { buildSeriesReplay, headlineMoment, topPerformers } from '@/lib/series-replay'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { Button } from '@/components/ui/button'
import { Scoreboard } from './broadcast/Scoreboard'
import { Diamond } from './broadcast/Diamond'
import { PlayFeed } from './broadcast/PlayFeed'
import { GameFinalCard } from './broadcast/GameFinalCard'
import { SeriesRecap } from './broadcast/SeriesRecap'
import {
  createInitialPlaybackState,
  createPlaybackReducer,
} from './broadcast/playback-reducer'

type SeriesBroadcastProps = {
  series: SimulatedSeries
  opponentName: string
  userTeamLabel?: string
  opponentTeamLabel?: string
  readOnly?: boolean
  actions?: ReactNode
}

type Speed = 1 | 2 | 4

function nextSpeed(speed: number): Speed {
  if (speed === 1) return 2
  if (speed === 2) return 4
  return 1
}

function userWonGame(
  userWasHome: boolean,
  homeScore: number,
  awayScore: number,
): boolean {
  return userWasHome ? homeScore > awayScore : awayScore > homeScore
}

function opponentWonGame(
  userWasHome: boolean,
  homeScore: number,
  awayScore: number,
): boolean {
  return userWasHome ? homeScore < awayScore : awayScore < homeScore
}

export default function SeriesBroadcast({
  series,
  opponentName,
  userTeamLabel = 'You',
  opponentTeamLabel,
  readOnly = false,
  actions,
}: SeriesBroadcastProps) {
  const resolvedOpponentLabel = opponentTeamLabel ?? opponentName
  const reducedMotion = useReducedMotion()

  const replay = useMemo(() => buildSeriesReplay(series), [series])
  const userStars = useMemo(() => topPerformers(series, 'user', 3), [series])
  const oppStars = useMemo(() => topPerformers(series, 'opponent', 3), [series])
  const headline = useMemo(() => headlineMoment(series), [series])

  const reducer = useMemo(
    () => createPlaybackReducer(replay.map((g) => g.length), !reducedMotion),
    [replay, reducedMotion],
  )
  const [state, dispatch] = useReducer(
    reducer,
    reducedMotion,
    createInitialPlaybackState,
  )

  useEffect(() => {
    if (state.phase !== 'playing' || !state.playing) return
    const id = window.setInterval(
      () => dispatch({ type: 'tick' }),
      Math.round(900 / state.speed),
    )
    return () => window.clearInterval(id)
  }, [state.phase, state.playing, state.speed])

  useEffect(() => {
    if (state.phase !== 'game-final' || reducedMotion) return
    const id = window.setTimeout(() => dispatch({ type: 'advance_game' }), 2500)
    return () => window.clearTimeout(id)
  }, [state.phase, reducedMotion])

  useEffect(() => {
    if (readOnly) return
    const handler = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        dispatch({ type: state.playing ? 'pause' : 'play' })
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        dispatch({ type: 'skip_play' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readOnly, state.playing])

  const gameFrames = replay[state.gameIndex] ?? []
  const frame =
    state.frameIndex < gameFrames.length ? gameFrames[state.frameIndex] : null

  const cumulativeUserWins = series.games
    .slice(0, state.gameIndex + 1)
    .filter((g) => userWonGame(g.userWasHome, g.homeScore, g.awayScore)).length
  const cumulativeOppWins = series.games
    .slice(0, state.gameIndex + 1)
    .filter((g) => opponentWonGame(g.userWasHome, g.homeScore, g.awayScore)).length

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {state.phase === 'series-final' ? (
        <>
          <SeriesRecap
            series={series}
            opponentName={opponentName}
            userTeamLabel={userTeamLabel}
            opponentTeamLabel={resolvedOpponentLabel}
            userStars={userStars}
            opponentStars={oppStars}
            headline={headline}
            readOnly={readOnly}
          />
          {actions}
          {reducedMotion && !readOnly && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => dispatch({ type: 'replay' })}
              >
                Replay
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {state.phase === 'playing' && frame && (
            <>
              <Scoreboard
                userTeamLabel={userTeamLabel}
                opponentTeamLabel={resolvedOpponentLabel}
                userScore={frame.scoreAfter.user}
                opponentScore={frame.scoreAfter.opponent}
                inning={frame.inning}
                half={frame.half}
                outs={frame.outsAfter}
                pitcherRole={frame.pitcherRole}
                pitcherName={frame.pitcherName}
                batterName={frame.batterName}
              />
              <Diamond bases={frame.basesAfter} />
              <PlayFeed
                frames={gameFrames}
                currentIndex={state.frameIndex}
                userTeamLabel={userTeamLabel}
                opponentTeamLabel={resolvedOpponentLabel}
              />
            </>
          )}

          {state.phase === 'game-final' && (
            <GameFinalCard
              game={series.games[state.gameIndex]}
              gameIndex={state.gameIndex}
              userTeamLabel={userTeamLabel}
              opponentTeamLabel={resolvedOpponentLabel}
              seriesUserWins={cumulativeUserWins}
              seriesOpponentWins={cumulativeOppWins}
            />
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {state.phase === 'playing' && !readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  dispatch({ type: state.playing ? 'pause' : 'play' })
                }
              >
                {state.playing ? 'Pause' : 'Play'}
              </Button>
            )}
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => dispatch({ type: 'skip_play' })}
              >
                Skip play
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: 'skip_game' })}
            >
              Skip game
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: 'skip_series' })}
            >
              Skip series
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                dispatch({ type: 'set_speed', speed: nextSpeed(state.speed) })
              }
            >
              {state.speed}x
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
