import { useEffect } from 'react'
import type { SimulatedGame } from '@shared/live/live-types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import GameBoxScoreCard from '@/components/GameBoxScoreCard'
import { buildGameBoxScore, buildLineScore } from '@/lib/box-score'

export type BoxScoreModalEntry = {
  label: string
  game: SimulatedGame
  awayLabel: string
  homeLabel: string
}

type GameBoxScoreModalProps = {
  title: string
  entries: BoxScoreModalEntry[]
  onClose: () => void
}

export default function GameBoxScoreModal({
  title,
  entries,
  onClose,
}: GameBoxScoreModalProps) {
  const open = entries.length > 0

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <Card
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="sticky top-0 z-10 bg-card pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="font-display text-base text-primary">
              {title}
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {entries.map((entry, i) => (
            <section key={i} aria-label={entry.label}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {entry.label}
              </h4>
              <GameBoxScoreCard
                box={buildGameBoxScore(entry.game)}
                lineScore={buildLineScore(entry.game)}
                awayLabel={entry.awayLabel}
                homeLabel={entry.homeLabel}
              />
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
