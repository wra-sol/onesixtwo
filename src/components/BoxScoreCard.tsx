import type { SimulatedGame } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

type BoxScoreCardProps = {
  game: SimulatedGame
  gameIndex: number
  isMarquee: boolean
  opponentName?: string
  outcome: 'W' | 'L'
}

export default function BoxScoreCard({
  game,
  gameIndex,
  isMarquee,
  opponentName,
  outcome,
}: BoxScoreCardProps) {
  const userScore = game.userWasHome ? game.homeScore : game.awayScore
  const oppScore = game.userWasHome ? game.awayScore : game.homeScore

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-1 text-xs',
        isMarquee
          ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
          : 'border-border bg-card/40',
      )}
      aria-label={`Game ${gameIndex + 1}: ${outcome} ${userScore}-${oppScore} vs ${opponentName ?? 'opponent'}`}
    >
      <span className="w-7 shrink-0 tabular-nums text-muted-foreground">
        {gameIndex + 1}
      </span>
      <span
        className={cn(
          'w-3 shrink-0 font-bold',
          outcome === 'W' ? 'text-primary' : 'text-destructive',
        )}
      >
        {outcome}
      </span>
      <span className="shrink-0 tabular-nums font-medium">
        {userScore}-{oppScore}
      </span>
      <span className="truncate text-muted-foreground">
        {opponentName ?? 'vs'}
      </span>
      {isMarquee && (
        <span
          className="ml-auto shrink-0 text-primary"
          aria-label="Marquee game"
          title="Marquee game"
        >
          ★
        </span>
      )}
    </div>
  )
}
