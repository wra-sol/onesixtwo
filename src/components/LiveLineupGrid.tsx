import { useId } from 'react'
import { useScrollToFirstAssign } from '@/hooks/useScrollToFirstAssign'
import { OrderEditor } from '@/components/OrderEditor'
import { Button } from '@/components/ui/button'
import {
  DAILY_HITTER_POSITIONS,
  DAILY_LINEUP_POSITIONS,
  DAILY_PITCHER_POSITIONS,
  playerEligibleForDailyPosition,
  type DailyLineup,
  type DailyLineupPosition,
} from '@shared/live/daily-roster'
import type { LivePlayer } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

type LiveLineupGridProps = {
  title?: string
  lineup: DailyLineup
  selectedPlayer: LivePlayer | null
  isAssigning: boolean
  onAssign: (position: DailyLineupPosition) => void
}

function Slot({
  position,
  player,
  selectedPlayer,
  isAssigning,
  onAssign,
}: {
  position: DailyLineupPosition
  player: LivePlayer | null
  selectedPlayer: LivePlayer | null
  isAssigning: boolean
  onAssign: (position: DailyLineupPosition) => void
}) {
  const eligible =
    selectedPlayer !== null &&
    playerEligibleForDailyPosition(selectedPlayer, position)
  const canAssign = isAssigning && eligible && player === null

  return (
    <div
      className={cn(
        'min-h-16 rounded-lg border border-border bg-muted/20 p-2 transition-colors',
        canAssign && 'border-primary bg-primary/10',
      )}
      data-position={position}
    >
      <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {position}
      </p>
      {player ? (
        <div className="mt-1">
          <p className="text-sm leading-tight font-medium">{player.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {player.teamAbbrev}
          </p>
        </div>
      ) : canAssign && selectedPlayer ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-1 min-h-11 w-full text-xs"
          data-lineup-assign="true"
          aria-label={`Assign ${selectedPlayer.name} to ${position}`}
          onClick={() => onAssign(position)}
        >
          Assign
        </Button>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {isAssigning && selectedPlayer ? 'Not eligible' : 'Open'}
        </p>
      )}
    </div>
  )
}

export default function LiveLineupGrid({
  title = 'Your lineup',
  lineup,
  selectedPlayer,
  isAssigning,
  onAssign,
}: LiveLineupGridProps) {
  const headingId = useId()
  useScrollToFirstAssign('lineup', isAssigning, selectedPlayer?.id ?? null)

  const filledCount = DAILY_LINEUP_POSITIONS.filter((position) => lineup[position]).length
  const hasEligibleSlot =
    selectedPlayer !== null &&
    DAILY_LINEUP_POSITIONS.some(
      (position) =>
        lineup[position] === null &&
        playerEligibleForDailyPosition(selectedPlayer, position),
    )

  return (
    <section
      className="game-roster-panel space-y-3 rounded-xl border border-border bg-card p-3"
      aria-labelledby={headingId}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="font-display text-base text-primary">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">
            One player per position · {filledCount}/12 filled
          </p>
        </div>
        {isAssigning && selectedPlayer && (
          <span className="rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            Assigning
          </span>
        )}
      </div>

      {isAssigning && selectedPlayer && (
        <div
          className={cn(
            'game-assignment-banner rounded-lg border px-3 py-2 text-sm',
            hasEligibleSlot
              ? 'border-primary/50 bg-primary/10 text-foreground'
              : 'border-destructive/50 bg-destructive/10 text-foreground',
          )}
          role="status"
        >
          <p className="font-semibold">{selectedPlayer.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasEligibleSlot
              ? 'Choose a highlighted open position.'
              : 'No open position fits this player. Pick someone else.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2" aria-label="Hitters">
        {DAILY_HITTER_POSITIONS.map((position) => (
          <Slot
            key={position}
            position={position}
            player={lineup[position]}
            selectedPlayer={selectedPlayer}
            isAssigning={isAssigning}
            onAssign={onAssign}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="Pitchers">
        {DAILY_PITCHER_POSITIONS.map((position) => (
          <Slot
            key={position}
            position={position}
            player={lineup[position]}
            selectedPlayer={selectedPlayer}
            isAssigning={isAssigning}
            onAssign={onAssign}
          />
        ))}
      </div>
    </section>
  )
}

type BattingOrderEditorProps = {
  order: LivePlayer[]
  onChange: (order: LivePlayer[]) => void
}

export function BattingOrderEditor(props: BattingOrderEditorProps) {
  return <OrderEditor title="Batting order" {...props} />
}
