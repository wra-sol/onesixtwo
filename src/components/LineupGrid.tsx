import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getEligiblePositionsForPlayer, getFilledCount } from '../lib/game'
import {
  type Lineup,
  type LineupPosition,
  type Player,
} from '../lib/types'

type LineupGridProps = {
  lineup: Lineup
  selectedPlayer: Player | null
  isAssigning?: boolean
  onAssign: (position: LineupPosition) => void
}

const FIELD_POSITIONS: LineupPosition[] = [
  'LF',
  'CF',
  'RF',
  'SS',
  '3B',
  '2B',
  '1B',
  'P',
  'C',
]

const MOBILE_STRIP_ROW_1: LineupPosition[] = ['C', '1B', '2B', '3B']
const MOBILE_STRIP_ROW_2: LineupPosition[] = ['SS', 'LF', 'CF', 'RF']
const MOBILE_STRIP_PITCHER: LineupPosition = 'P'

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] ?? name
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
  const chipClass = `lineup-chip${filled ? ' lineup-chip--filled' : ''}${pitcher ? ' lineup-chip--pitcher' : ''}`

  if (canAssign) {
    return (
      <button
        type="button"
        className={`${chipClass} lineup-chip--assignable`}
        data-pos={position}
        onClick={onAssign}
        aria-label={`Assign to ${position}`}
      >
        <span className="lineup-chip-pos">{position}</span>
        <span className="lineup-chip-name">Tap</span>
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

function MobileLineupStrip({
  lineup,
  eligible,
  selectedPlayer,
  onAssign,
}: {
  lineup: Lineup
  eligible: LineupPosition[]
  selectedPlayer: Player | null
  onAssign: (position: LineupPosition) => void
}) {
  const renderChip = (position: LineupPosition, pitcher = false) => {
    const filled = lineup[position]
    const canAssign =
      selectedPlayer !== null && !filled && eligible.includes(position)
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
    <div className="lineup-strip" role="group" aria-label="Lineup positions">
      <div className="lineup-strip-rows">
        <div className="lineup-strip-row">
          {MOBILE_STRIP_ROW_1.map((pos) => renderChip(pos))}
        </div>
        <div className="lineup-strip-row">
          {MOBILE_STRIP_ROW_2.map((pos) => renderChip(pos))}
        </div>
      </div>
      <div className="lineup-strip-pitcher">
        {renderChip(MOBILE_STRIP_PITCHER, true)}
      </div>
    </div>
  )
}

export default function LineupGrid({
  lineup,
  selectedPlayer,
  isAssigning = false,
  onAssign,
}: LineupGridProps) {
  const eligible = selectedPlayer
    ? getEligiblePositionsForPlayer(selectedPlayer, lineup)
    : []
  const filledCount = getFilledCount(lineup)

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
          Lineup ({filledCount}/9)
        </h2>
        <MobileLineupStrip
          lineup={lineup}
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
            Lineup ({filledCount}/9)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="lineup-field">
            <div className="lineup-field-grass" aria-hidden="true" />
            <div className="lineup-field-dirt" aria-hidden="true" />
            <div
              className="lineup-grid"
              role="group"
              aria-label="Lineup positions"
            >
              {FIELD_POSITIONS.map((position) => {
                const filled = lineup[position]
                const canAssign =
                  selectedPlayer !== null &&
                  !filled &&
                  eligible.includes(position)

                return (
                  <div
                    key={position}
                    className={`lineup-slot ${filled ? 'lineup-slot--filled' : ''} ${canAssign ? 'lineup-slot--assignable' : ''}`}
                    data-pos={position}
                  >
                    <span className="lineup-slot-pos">{position}</span>
                    {filled ? (
                      <div className="lineup-slot-player">
                        <span className="lineup-slot-name">
                          {lastName(filled.name)}
                        </span>
                      </div>
                    ) : selectedPlayer && canAssign ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="h-auto w-full px-1 py-0.5 text-[0.65rem] leading-tight"
                        onClick={() => onAssign(position)}
                      >
                        Assign
                      </Button>
                    ) : (
                      <span className="lineup-slot-empty">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
