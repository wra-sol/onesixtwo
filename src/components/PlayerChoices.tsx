import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getPlayerDisabledReason } from '../lib/game'
import {
  comparePlayersByStat,
  comparePlayersRandom,
  PLAYER_STAT_SORT_LABELS,
} from '../lib/player-stats'
import type { PlayerStatSortLabel } from '../lib/player-stats'
import type { GameState, LineupPosition, Player } from '../lib/types'
import { LINEUP_POSITIONS } from '../lib/types'
import { normalizeForSearch } from '../lib/text'
import PlayerCard from './PlayerCard'

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
  const [sort, setSort] = useState<PlayerStatSortLabel>('Random')

  const filtered = useMemo(() => {
    let list = [...players]
    const q = normalizeForSearch(search.trim())
    if (q) {
      list = list.filter((p) => normalizeForSearch(p.name).includes(q))
    }
    if (positionFilter !== 'all') {
      list = list.filter((p) => p.positions.includes(positionFilter))
    }
    if (sort === 'Random') {
      const seed = `${gameState.round}|${gameState.currentBucket?.id ?? 'none'}`
      list.sort((a, b) => comparePlayersRandom(a, b, seed))
    } else {
      list.sort((a, b) => comparePlayersByStat(a, b, sort))
    }
    return list
  }, [players, search, positionFilter, sort, gameState.round, gameState.currentBucket?.id])

  const pickableCount = useMemo(
    () =>
      players.filter((p) => getPlayerDisabledReason(p, gameState) === null)
        .length,
    [players, gameState],
  )

  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No players left in this spin. Respinning…
      </p>
    )
  }

  const playerList =
    filtered.length === 0 ? (
      <p className="py-6 text-center text-sm text-muted-foreground" role="status">
        No players match filters.
      </p>
    ) : (
      <div className="divide-y divide-border" role="list">
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
                compact
                onSelect={() => onSelect(player.id)}
              />
            </div>
          )
        })}
      </div>
    )

  return (
    <section className="space-y-3" aria-labelledby="choices-heading">
      <h3
        id="choices-heading"
        className="font-display text-base text-primary"
      >
        Players · {pickableCount} pickable
      </h3>

      <div className="flex flex-wrap gap-2">
        <Input
          id="player-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className="min-w-[7rem] flex-1"
          aria-label="Search players"
        />
        <Select
          value={positionFilter}
          onValueChange={(v) => setPositionFilter(v as LineupPosition | 'all')}
        >
          <SelectTrigger
            id="position-filter"
            className="w-[5.5rem]"
            aria-label="Filter by position"
          >
            <SelectValue placeholder="Pos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {LINEUP_POSITIONS.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as PlayerStatSortLabel)}
        >
          <SelectTrigger
            id="sort-filter"
            className="w-[5.5rem]"
            aria-label="Sort by stat"
          >
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {PLAYER_STAT_SORT_LABELS.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {playerList}
    </section>
  )
}
