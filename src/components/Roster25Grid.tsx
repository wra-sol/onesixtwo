import { useId } from 'react'
import { useScrollToFirstAssign } from '@/hooks/useScrollToFirstAssign'
import { OrderEditor } from '@/components/OrderEditor'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  playerEligibleForRoster25Slot,
  roster25Players,
  ROSTER25_POSITION_SLOTS,
  type Roster25,
  type Roster25Slot,
} from '@shared/live/roster25'
import type { LivePlayer } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

const LINEUP_SLOTS: Roster25Slot[] = [
  'C1',
  'C2',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
  'DH',
]
const BENCH_SLOTS: Roster25Slot[] = ['BENCH1', 'BENCH2', 'BENCH3']
const ROTATION_SLOTS: Roster25Slot[] = ['SP1', 'SP2', 'SP3', 'SP4', 'SP5']
const BULLPEN_SLOTS: Roster25Slot[] = [
  'RP1',
  'RP2',
  'RP3',
  'RP4',
  'RP5',
  'RP6',
  'CL',
]

type Roster25GridProps = {
  title?: string
  roster: Roster25
  selectedPlayer: LivePlayer | null
  isAssigning: boolean
  onAssign: (slot: Roster25Slot) => void
}

function Slot({
  slot,
  player,
  selectedPlayer,
  isAssigning,
  onAssign,
}: {
  slot: Roster25Slot
  player: LivePlayer | null
  selectedPlayer: LivePlayer | null
  isAssigning: boolean
  onAssign: (slot: Roster25Slot) => void
}) {
  const eligible =
    selectedPlayer !== null && playerEligibleForRoster25Slot(selectedPlayer, slot)
  const canAssign = isAssigning && eligible && player === null

  return (
    <div
      className={cn(
        'min-h-16 rounded-lg border border-border bg-muted/20 p-2 transition-colors',
        canAssign && 'border-primary bg-primary/10',
      )}
      data-slot={slot}
    >
      <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {slot}
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
          data-roster25-assign="true"
          aria-label={`Assign ${selectedPlayer.name} to ${slot}`}
          onClick={() => onAssign(slot)}
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

function SlotGroup({
  title,
  slots,
  roster,
  selectedPlayer,
  isAssigning,
  onAssign,
  columns,
}: {
  title: string
  slots: Roster25Slot[]
  roster: Roster25
  selectedPlayer: LivePlayer | null
  isAssigning: boolean
  onAssign: (slot: Roster25Slot) => void
  columns: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-display text-xs text-primary">{title}</p>
      <div className={cn('grid gap-2', columns)}>
        {slots.map((slot) => (
          <Slot
            key={slot}
            slot={slot}
            player={roster[slot]}
            selectedPlayer={selectedPlayer}
            isAssigning={isAssigning}
            onAssign={onAssign}
          />
        ))}
      </div>
    </div>
  )
}

export default function Roster25Grid({
  title = '25-Man Roster',
  roster,
  selectedPlayer,
  isAssigning,
  onAssign,
}: Roster25GridProps) {
  const headingId = useId()
  useScrollToFirstAssign('roster25', isAssigning, selectedPlayer?.id ?? null)

  const filled = roster25Players(roster).length
  const hasEligibleSlot =
    selectedPlayer !== null &&
    ROSTER25_POSITION_SLOTS.some(
      (slot) => roster[slot] === null && playerEligibleForRoster25Slot(selectedPlayer, slot),
    )

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-3 shadow-sm"
      aria-labelledby={headingId}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id={headingId} className="font-display text-base text-primary">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">
              One player per team · {filled}/25 filled
            </p>
          </div>
          {isAssigning && selectedPlayer && (
            <span className="rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Assigning
            </span>
          )}
        </div>
        <Progress
          value={(filled / 25) * 100}
          max={100}
          aria-label={`${filled} of 25 roster slots filled`}
        />
      </div>

      {isAssigning && selectedPlayer && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            hasEligibleSlot
              ? 'border-primary/50 bg-primary/10'
              : 'border-destructive/50 bg-destructive/10',
          )}
          role="status"
        >
          <p className="font-semibold">{selectedPlayer.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasEligibleSlot
              ? 'Choose a highlighted open slot.'
              : 'No open slot fits this player. Pick someone else.'}
          </p>
        </div>
      )}

      <SlotGroup
        title="Starting Lineup"
        slots={LINEUP_SLOTS}
        roster={roster}
        selectedPlayer={selectedPlayer}
        isAssigning={isAssigning}
        onAssign={onAssign}
        columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
      />
      <SlotGroup
        title="Bench"
        slots={BENCH_SLOTS}
        roster={roster}
        selectedPlayer={selectedPlayer}
        isAssigning={isAssigning}
        onAssign={onAssign}
        columns="grid-cols-3"
      />
      <SlotGroup
        title="Rotation"
        slots={ROTATION_SLOTS}
        roster={roster}
        selectedPlayer={selectedPlayer}
        isAssigning={isAssigning}
        onAssign={onAssign}
        columns="grid-cols-3 sm:grid-cols-5"
      />
      <SlotGroup
        title="Bullpen"
        slots={BULLPEN_SLOTS}
        roster={roster}
        selectedPlayer={selectedPlayer}
        isAssigning={isAssigning}
        onAssign={onAssign}
        columns="grid-cols-3 sm:grid-cols-4 md:grid-cols-7"
      />
    </section>
  )
}

type RotationOrderEditorProps = {
  order: LivePlayer[]
  onChange: (order: LivePlayer[]) => void
}

export function RotationOrderEditor(props: RotationOrderEditorProps) {
  return (
    <OrderEditor
      title="Rotation order"
      labelFor={(player, index) => `SP${index + 1}. ${player.name}`}
      {...props}
    />
  )
}
