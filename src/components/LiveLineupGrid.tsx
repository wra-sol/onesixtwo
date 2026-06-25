import { Button } from '@/components/ui/button'
import {
  DAILY_HITTER_POSITIONS,
  DAILY_LINEUP_POSITIONS,
  DAILY_PITCHER_POSITIONS,
  playerEligibleForDailyPosition,
  type DailyLineup,
  type DailyLineupPosition,
} from '@/lib/daily-roster'
import type { LivePlayer } from '@/lib/live-types'
import { cn } from '@/lib/utils'

type LiveLineupGridProps = {
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

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2">
      <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {position}
      </p>
      {player ? (
        <p className="text-sm font-medium">{player.name}</p>
      ) : isAssigning && eligible ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-1 h-7 w-full text-xs"
          onClick={() => onAssign(position)}
        >
          Assign
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Empty</p>
      )}
    </div>
  )
}

export default function LiveLineupGrid({
  lineup,
  selectedPlayer,
  isAssigning,
  onAssign,
}: LiveLineupGridProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <h3 className="font-display text-sm text-primary">Lineup</h3>
      <div className="grid grid-cols-3 gap-2">
        {DAILY_HITTER_POSITIONS.map((pos) => (
          <Slot
            key={pos}
            position={pos}
            player={lineup[pos]}
            selectedPlayer={selectedPlayer}
            isAssigning={isAssigning}
            onAssign={onAssign}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DAILY_PITCHER_POSITIONS.map((pos) => (
          <Slot
            key={pos}
            position={pos}
            player={lineup[pos]}
            selectedPlayer={selectedPlayer}
            isAssigning={isAssigning}
            onAssign={onAssign}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {DAILY_LINEUP_POSITIONS.filter((p) => lineup[p]).length}/12 filled
      </p>
    </div>
  )
}

type BattingOrderEditorProps = {
  order: LivePlayer[]
  onChange: (order: LivePlayer[]) => void
}

export function BattingOrderEditor({ order, onChange }: BattingOrderEditorProps) {
  const move = (index: number, direction: -1 | 1) => {
    const next = [...order]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <h3 className="font-display text-sm text-primary">Batting order</h3>
      <ol className="space-y-1">
        {order.map((player, index) => (
          <li
            key={player.id}
            className={cn(
              'flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm',
            )}
          >
            <span>
              {index + 1}. {player.name}
            </span>
            <span className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
