import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SimulatedSeries } from '@shared/live/live-types'

type LiveResultScreenProps = {
  series: SimulatedSeries
  opponentName: string
  onRestart: () => void
  submitSlot?: React.ReactNode
}

export default function LiveResultScreen({
  series,
  opponentName,
  onRestart,
  submitSlot,
}: LiveResultScreenProps) {
  const [revealedGames, setRevealedGames] = useState(1)

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader className="text-center">
        <CardTitle className="font-display text-xl text-primary">
          {series.wonSeries ? 'Series win' : 'Series loss'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          You {series.userWins}-{series.opponentWins} vs {opponentName} · Runs{' '}
          {series.userRuns}-{series.opponentRuns}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {series.games.slice(0, revealedGames).map((game, index) => {
          const userScore = game.userWasHome ? game.homeScore : game.awayScore
          const oppScore = game.userWasHome ? game.awayScore : game.homeScore
          return (
            <div
              key={`game-${index}`}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <p className="font-semibold">
                Game {index + 1}: You {userScore}, {opponentName} {oppScore}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-primary">
                  Play-by-play
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {game.events.slice(-40).map((event, eventIndex) => (
                    <li key={`${index}-${eventIndex}`}>
                      {event.inning}{event.half === 'top' ? '↑' : '↓'} {event.description}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )
        })}

        {revealedGames < series.games.length && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevealedGames((count) => count + 1)}
          >
            Reveal next game
          </Button>
        )}

        {submitSlot}

        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={onRestart}>
            Play again
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.href = '/leaderboard'}>
            Leaderboard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
