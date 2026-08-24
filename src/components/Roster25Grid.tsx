import { useScrollToFirstAssign } from '@/hooks/useScrollToFirstAssign'
import { OrderEditor } from '@/components/OrderEditor'
import { Button } from '@/components/ui/button'
import {
  playerEligibleForRoster25Slot,
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

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2">
      <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {slot}
      </p>
      {player ? (
        <div>
          <p className="text-sm font-medium">{player.name}</p>
          <p className="text-xs text-muted-foreground">{player.teamAbbrev}</p>
        </div>
      ) : isAssigning && eligible ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-1 h-8 w-full scroll-mt-24 text-xs"
          data-roster25-assign="true"
          onClick={() => onAssign(slot)}
        >
          Assign
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Open</p>
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
  roster,
  selectedPlayer,
  isAssigning,
  onAssign,
}: Roster25GridProps) {
  useScrollToFirstAssign('roster25', isAssigning, selectedPlayer?.id ?? null)

  const filled = ROSTER25_POSITION_SLOTS.filter((s) => roster[s]).length

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-3">
      <h3 className="font-display text-sm text-primary">25-Man Roster</h3>
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
      <p className="text-xs text-muted-foreground">{filled}/25 filled</p>
    </div>
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
