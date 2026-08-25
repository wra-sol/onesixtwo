import { useState } from 'react'
import type { SimulatedGame, SimBoxScore } from '@shared/live/live-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildGameBoxScore, buildLineScore } from '@/lib/box-score'
import { sideLabels, userGameSides } from '@/lib/sim162-display'
import GameBoxScoreCard from '@/components/GameBoxScoreCard'

type GameFinalCardProps = {
  game: SimulatedGame
  gameIndex: number
  userTeamLabel: string
  opponentTeamLabel: string
  seriesUserWins: number
  seriesOpponentWins: number
}

const TOTAL_GAMES = 3

function boxLine(box: SimBoxScore): string {
  const parts = [`R ${box.runs}`, `H ${box.hits}`, `HR ${box.homeRuns}`]
  if (box.errors > 0) parts.push(`E ${box.errors}`)
  return parts.join(' · ')
}

export function GameFinalCard({
  game,
  gameIndex,
  userTeamLabel,
  opponentTeamLabel,
  seriesUserWins,
  seriesOpponentWins,
}: GameFinalCardProps) {
  const [showBox, setShowBox] = useState(false)
  const { score, box } = userGameSides(game)
  const userScore = score.user
  const oppScore = score.opponent
  const userBox = box.user
  const oppBox = box.opponent

  const tally = Array.from({ length: TOTAL_GAMES }, (_, i) => {
    if (i < seriesUserWins) return 'user' as const
    if (i < seriesUserWins + seriesOpponentWins) return 'opp' as const
    return 'empty' as const
  })

  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader className="items-center text-center">
        <CardTitle className="font-display text-lg text-primary">
          Game {gameIndex + 1} final
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-bold tabular-nums">
          {userTeamLabel} {userScore} — {oppScore} {opponentTeamLabel}
        </p>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            <span className="text-foreground">{userTeamLabel}</span> ·{' '}
            {boxLine(userBox)}
          </p>
          <p>
            <span className="text-foreground">{opponentTeamLabel}</span> ·{' '}
            {boxLine(oppBox)}
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={showBox}
            onClick={() => setShowBox((v) => !v)}
          >
            {showBox ? 'Hide box score' : 'Box score'}
          </Button>
          {showBox && (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2">
              <GameBoxScoreCard
                box={buildGameBoxScore(game)}
                lineScore={buildLineScore(game)}
                {...sideLabels(game, userTeamLabel, opponentTeamLabel)}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2" aria-label={`Series ${seriesUserWins}-${seriesOpponentWins}`}>
          {tally.map((kind, i) => (
            <span
              key={i}
              className={cn(
                'size-3 rounded-full border',
                kind === 'user' && 'border-primary bg-primary',
                kind === 'opp' && 'border-destructive bg-destructive',
                kind === 'empty' && 'border-border bg-transparent',
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
