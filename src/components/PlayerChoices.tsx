import { useMemo, useState } from 'react'
import type { LineupPosition, Player } from '../lib/types'
import { LINEUP_POSITIONS } from '../lib/types'
import { getPlayerDisabledReason } from '../lib/game'
import type { GameState } from '../lib/types'
import PlayerCard from './PlayerCard'

type SortKey = 'overall' | 'name' | 'position'

type PlayerChoicesProps = {
  players: Player[]
  gameState: GameState
  selectedPlayerId: string | null
  onSelect: (playerId: string) => void
}

export default function PlayerChoices({
  players,
  gameState,
  selectedPlayerId,
  onSelect,
}: PlayerChoicesProps) {
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<LineupPosition | 'all'>(
    'all',
  )
  const [sort, setSort] = useState<SortKey>('overall')
  const [compact, setCompact] = useState(true)

  const filtered = useMemo(() => {
    let list = [...players]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    if (positionFilter !== 'all') {
      list = list.filter((p) => p.positions.includes(positionFilter))
    }
    list.sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name)
      }
      if (sort === 'position') {
        return a.positions[0].localeCompare(b.positions[0])
      }
      return b.ratings.overall - a.ratings.overall
    })
    return list
  }, [players, search, positionFilter, sort])

  if (players.length === 0) {
    return (
      <p className="empty-choices" role="status">
        No eligible players in this spin. Respinning…
      </p>
    )
  }

  return (
    <section className="player-choices" aria-labelledby="choices-heading">
      <h3 id="choices-heading">Pick one player ({filtered.length})</h3>
      <div className="player-filters">
        <label className="filter-label">
          Search
          <input
            type="search"
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player name"
          />
        </label>
        <label className="filter-label">
          Position
          <select
            className="filter-select"
            value={positionFilter}
            onChange={(e) =>
              setPositionFilter(e.target.value as LineupPosition | 'all')
            }
          >
            <option value="all">All</option>
            {LINEUP_POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-label">
          Sort
          <select
            className="filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="overall">Overall</option>
            <option value="name">Name</option>
            <option value="position">Position</option>
          </select>
        </label>
        <label className="filter-label filter-label--check">
          <input
            type="checkbox"
            checked={compact}
            onChange={(e) => setCompact(e.target.checked)}
          />
          Compact list
        </label>
      </div>
      <div
        className={
          compact ? 'player-choices-list' : 'player-choices-grid'
        }
        role="list"
      >
        {filtered.map((player) => {
          const disabledReason = getPlayerDisabledReason(player, gameState)
          const selectable = disabledReason === null
          return (
            <div key={player.id} role="listitem">
              <PlayerCard
                player={player}
                selected={selectedPlayerId === player.id}
                disabled={!selectable}
                disabledReason={disabledReason}
                compact={compact}
                onSelect={() => onSelect(player.id)}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
