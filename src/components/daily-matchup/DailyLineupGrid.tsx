import { useScrollToFirstAssign } from '@/hooks/useScrollToFirstAssign'
import { Button } from '@/components/ui/button'
import {
  DAILY_HITTER_POSITIONS,
  DAILY_PITCHER_POSITIONS,
  playerEligibleForDailyPosition,
  type DailyLineup,
  type DailyLineupPosition,
} from '@shared/live/daily-roster'
import { continuousToDisplayGrade, GRADE_LABELS } from '@shared/live/live-grades'
import type { LivePlayer } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

type DailyLineupGridProps = {
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
    selectedPlayer !== null && playerEligibleForDailyPosition(selectedPlayer, position)
  const overall = player ? continuousToDisplayGrade(player.grades.overall) : null

  return (
    <div
      className={cn(
        'rounded-lg border p-2 transition-colors',
        player
          ? 'border-border bg-card'
          : eligible
            ? 'border-primary/50 bg-primary/5'
            : 'border-border bg-muted/20',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
          {position}
        </p>
        {player && overall !== null && (
          <span className="text-[0.65rem] tabular-nums text-primary">
            {overall} {GRADE_LABELS[overall]}
          </span>
        )}
      </div>
      {player ? (
        <div className="mt-0.5">
          <p className="truncate text-sm font-medium">{player.name}</p>
          <p className="text-[0.65rem] text-muted-foreground">{player.teamAbbrev}</p>
        </div>
      ) : isAssigning && eligible ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-1 h-8 w-full scroll-mt-24 text-xs"
          data-lineup-assign="true"
          onClick={() => onAssign(position)}
        >
          Assign
        </Button>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">Empty</p>
      )}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

export default function DailyLineupGrid({
  lineup,
  selectedPlayer,
  isAssigning,
  onAssign,
}: DailyLineupGridProps) {
  useScrollToFirstAssign('lineup', isAssigning, selectedPlayer?.id ?? null)

  const hittersFilled = DAILY_HITTER_POSITIONS.filter((p) => lineup[p]).length
  const pitchersFilled = DAILY_PITCHER_POSITIONS.filter((p) => lineup[p]).length

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-primary">Your lineup</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {hittersFilled + pitchersFilled}/12
        </span>
      </div>

      <div>
        <GroupLabel>Hitters · {hittersFilled}/9</GroupLabel>
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
      </div>

      <div>
        <GroupLabel>Pitchers · {pitchersFilled}/3</GroupLabel>
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
      </div>
    </div>
  )
}
