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
          className="mt-1 h-7 w-full scroll-mt-24 text-xs"
          data-lineup-assign="true"
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
  useScrollToFirstAssign('lineup', isAssigning, selectedPlayer?.id ?? null)

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

export function BattingOrderEditor(props: BattingOrderEditorProps) {
  return <OrderEditor title="Batting order" {...props} />
}
