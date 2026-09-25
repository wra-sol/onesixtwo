import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type GameTurnStripProps = {
  /** Short state label, such as "Round 4" or "Your move". */
  label: string
  /** The one action the player should take next. */
  title: string
  detail: string
  progress?: {
    value: number
    label: string
  }
  tone?: 'active' | 'waiting' | 'setup'
  className?: string
}

/**
 * The shared draft status surface. Every mode answers the same three
 * questions before the player reaches the roster grid: whose turn is it,
 * what happens next, and how much of the roster is complete.
 */
export default function GameTurnStrip({
  label,
  title,
  detail,
  progress,
  tone = 'active',
  className,
}: GameTurnStripProps) {
  return (
    <section
      className={cn('game-turn-strip', `game-turn-strip--${tone}`, className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="min-w-0">
        <p className="game-turn-strip__label">{label}</p>
        <p className="game-turn-strip__title">{title}</p>
        <p className="game-turn-strip__detail">{detail}</p>
      </div>
      {progress && (
        <div className="game-turn-strip__aside">
          <div className="min-w-32 flex-1 space-y-1 md:max-w-48">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold tabular-nums text-foreground">
                {progress.label}
              </span>
            </div>
            <Progress
              value={progress.value}
              max={100}
              aria-label={`${progress.label} roster slots filled`}
            />
          </div>
        </div>
      )}
    </section>
  )
}
