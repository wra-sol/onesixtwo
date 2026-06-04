import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  getActiveLineupPositions,
  rosterFormatSlotCount,
} from '../lib/roster-format'
import { getEligiblePositionsForPlayer, getFilledCount } from '../lib/game'
import {
  type Lineup,
  type LineupPosition,
  type Player,
  type RosterFormatId,
} from '../lib/types'

type LineupGridProps = {
  lineup: Lineup
  rosterFormatId: RosterFormatId
  selectedPlayer: Player | null
  isAssigning?: boolean
  onAssign: (position: LineupPosition) => void
}

/** Desktop diamond render order (visual layering). */
const DESKTOP_FIELD_ORDER: LineupPosition[] = [
  'LF',
  'CF',
  'RF',
  'SS',
  '3B',
  '2B',
  '1B',
  'DH',
  'SP',
  'RP',
  'C',
]

const MOBILE_STRIP_ROW_1: LineupPosition[] = ['C', '1B', '2B', '3B']
const MOBILE_STRIP_ROW_2: LineupPosition[] = ['SS', 'LF', 'CF', 'RF']
const MOBILE_STRIP_PITCHER: LineupPosition = 'SP'

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] ?? name
}

function isPitcherRolePosition(position: LineupPosition): boolean {
  return position === 'SP' || position === 'RP'
}

function LineupChip({
  position,
  filled,
  canAssign,
  pitcher = false,
  onAssign,
}: {
  position: LineupPosition
  filled: Player | null
  canAssign: boolean
  pitcher?: boolean
  onAssign: () => void
}) {
  const label = filled ? lastName(filled.name) : '·'
  const chipClass = cn(
    'lineup-chip',
    filled && 'lineup-chip--filled',
    pitcher && 'lineup-chip--pitcher',
  )

  if (canAssign) {
    const actionLabel = filled ? 'Switch' : 'Tap'
    return (
      <button
        type="button"
        className={cn(chipClass, 'lineup-chip--assignable')}
        data-pos={position}
        onClick={onAssign}
        aria-label={
          filled ? `Switch ${filled.name} from ${position}` : `Assign to ${position}`
        }
      >
        <span className="lineup-chip-pos">{position}</span>
        <span className="lineup-chip-name">{actionLabel}</span>
      </button>
    )
  }

  return (
    <div
      className={chipClass}
      data-pos={position}
      aria-label={filled ? `${position}: ${filled.name}` : `${position}: empty`}
    >
      <span className="lineup-chip-pos">{position}</span>
      <span className="lineup-chip-name">{label}</span>
    </div>
  )
}

function DesktopLineupSlot({
  position,
  filled,
  canAssign,
  onAssign,
}: {
  position: LineupPosition
  filled: Player | null
  canAssign: boolean
  onAssign: () => void
}) {
  const optional = position === 'DH' || position === 'RP'
  const pitcherRole = isPitcherRolePosition(position)

  return (
    <div
      className={cn(
        'lineup-slot',
        filled && 'lineup-slot--filled',
        canAssign && 'lineup-slot--assignable',
        optional && 'lineup-slot--optional',
        pitcherRole && 'lineup-slot--pitcher-role',
      )}
      data-pos={position}
    >
      <span className="lineup-slot-pos">{position}</span>
      {filled && !canAssign ? (
        <div className="lineup-slot-player">
          <span className="lineup-slot-name">{lastName(filled.name)}</span>
        </div>
      ) : canAssign ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-auto w-full px-1 py-0.5 text-[0.65rem] leading-tight"
          onClick={onAssign}
        >
          {filled ? 'Switch' : 'Assign'}
        </Button>
      ) : (
        <span className="lineup-slot-empty">—</span>
      )}
    </div>
  )
}

function MobileLineupStrip({
  lineup,
  rosterFormatId,
  eligible,
  selectedPlayer,
  onAssign,
}: {
  lineup: Lineup
  rosterFormatId: RosterFormatId
  eligible: LineupPosition[]
  selectedPlayer: Player | null
  onAssign: (position: LineupPosition) => void
}) {
  const active = getActiveLineupPositions(rosterFormatId)
  const optional = active.filter((p) => p === 'DH' || p === 'RP')
  const expandedPitcherColumn = optional.length > 0

  const renderChip = (position: LineupPosition, pitcher = false) => {
    const filled = lineup[position]
    const canAssign =
      selectedPlayer !== null && eligible.includes(position)
    return (
      <LineupChip
        key={position}
        position={position}
        filled={filled}
        canAssign={canAssign}
        pitcher={pitcher}
        onAssign={() => onAssign(position)}
      />
    )
  }

  return (
    <div
      className={cn(
        'lineup-strip',
        expandedPitcherColumn && 'lineup-strip--expanded',
      )}
      role="group"
      aria-label="Lineup positions"
    >
      <div className="lineup-strip-rows">
        <div className="lineup-strip-row">
          {MOBILE_STRIP_ROW_1.map((pos) => renderChip(pos))}
        </div>
        <div className="lineup-strip-row">
          {MOBILE_STRIP_ROW_2.map((pos) => renderChip(pos))}
        </div>
      </div>
      <div className="lineup-strip-pitcher flex flex-col gap-1">
        {renderChip(MOBILE_STRIP_PITCHER, true)}
        {optional.map((pos) => renderChip(pos, pos === 'RP'))}
      </div>
    </div>
  )
}

export default function LineupGrid({
  lineup,
  rosterFormatId,
  selectedPlayer,
  isAssigning = false,
  onAssign,
}: LineupGridProps) {
  const eligible = selectedPlayer
    ? getEligiblePositionsForPlayer(
        selectedPlayer,
        lineup,
        rosterFormatId,
      )
    : []
  const filledCount = getFilledCount(lineup, rosterFormatId)
  const totalSlots = rosterFormatSlotCount(rosterFormatId)
  const activeSet = new Set(getActiveLineupPositions(rosterFormatId))
  const hasOptionalSlots = activeSet.has('DH') || activeSet.has('RP')
  const desktopPositions = DESKTOP_FIELD_ORDER.filter((pos) =>
    activeSet.has(pos),
  )

  return (
    <>
      <section
        className="lineup-mobile px-4 md:hidden"
        aria-labelledby="lineup-heading-mobile"
      >
        {isAssigning && selectedPlayer && (
          <p
            className="lineup-assign-banner mb-1.5 rounded-md border border-primary/50 bg-primary/10 px-2 py-1.5 text-center text-xs font-medium text-foreground"
            role="status"
          >
            Tap a position for{' '}
            <span className="font-bold text-primary">{selectedPlayer.name}</span>
          </p>
        )}
        <h2
          id="lineup-heading-mobile"
          className="font-display text-xs text-primary"
        >
          Lineup ({filledCount}/{totalSlots})
        </h2>
        <MobileLineupStrip
          lineup={lineup}
          rosterFormatId={rosterFormatId}
          eligible={eligible}
          selectedPlayer={selectedPlayer}
          onAssign={onAssign}
        />
      </section>

      <Card className="hidden md:block" aria-labelledby="lineup-heading">
        <CardHeader className="pb-2">
          <CardTitle
            id="lineup-heading"
            className="font-display text-base text-primary"
          >
            Lineup ({filledCount}/{totalSlots})
          </CardTitle>
          {isAssigning && selectedPlayer && (
            <p className="text-xs text-muted-foreground" role="status">
              Click a position for{' '}
              <span className="font-semibold text-primary">
                {selectedPlayer.name}
              </span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'lineup-field',
              hasOptionalSlots && 'lineup-field--expanded',
            )}
          >
            <div className="lineup-field-grass" aria-hidden="true" />
            <div className="lineup-field-dirt" aria-hidden="true" />
            <div
              className="lineup-grid"
              role="group"
              aria-label="Lineup positions on field"
            >
              {desktopPositions.map((position) => (
                <DesktopLineupSlot
                  key={position}
                  position={position}
                  filled={lineup[position]}
                  canAssign={
                    selectedPlayer !== null && eligible.includes(position)
                  }
                  onAssign={() => onAssign(position)}
                />
              ))}
            </div>
          </div>
          {hasOptionalSlots && (
            <p className="mt-2 text-center text-[0.65rem] text-muted-foreground">
              DH: designated hitter · RP: reliever (bullpen)
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
