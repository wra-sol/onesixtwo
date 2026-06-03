import { getEligiblePositionsForPlayer } from '../lib/game'
import { type Lineup, type LineupPosition, type Player } from '../lib/types'

type LineupGridProps = {
  lineup: Lineup
  selectedPlayer: Player | null
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

export default function LineupGrid({
  lineup,
  selectedPlayer,
  onAssign,
}: LineupGridProps) {
  const eligible = selectedPlayer
    ? getEligiblePositionsForPlayer(selectedPlayer, lineup)
    : []

  return (
    <section className="lineup-grid-section" aria-labelledby="lineup-heading">
      <h3 id="lineup-heading">Starting lineup</h3>
      <div className="lineup-field">
        <div className="lineup-field-grass" aria-hidden="true" />
        <div className="lineup-field-dirt" aria-hidden="true" />
        <div className="lineup-grid" role="group" aria-label="Lineup positions">
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
                    <span className="lineup-slot-name">{filled.name}</span>
                    <span className="lineup-slot-ovr">OVR {filled.ratings.overall}</span>
                  </div>
                ) : selectedPlayer && canAssign ? (
                  <button
                    type="button"
                    className="btn btn-assign"
                    onClick={() => onAssign(position)}
                  >
                    Assign
                  </button>
                ) : (
                  <span className="lineup-slot-empty">—</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
