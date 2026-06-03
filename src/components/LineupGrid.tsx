import { getEligiblePositionsForPlayer } from '../lib/game'
import { LINEUP_POSITIONS, type Lineup, type LineupPosition, type Player } from '../lib/types'

type LineupGridProps = {
  lineup: Lineup
  selectedPlayer: Player | null
  onAssign: (position: LineupPosition) => void
}

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
      <div className="lineup-grid">
        {LINEUP_POSITIONS.map((position) => {
          const filled = lineup[position]
          const canAssign =
            selectedPlayer !== null &&
            !filled &&
            eligible.includes(position)

          return (
            <div
              key={position}
              className={`lineup-slot ${filled ? 'lineup-slot--filled' : ''}`}
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
                  Assign here
                </button>
              ) : (
                <span className="lineup-slot-empty">Empty</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
