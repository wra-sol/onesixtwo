import { useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [sort, setSort] = useState<PlayerStatSortLabel>('OPS')
  const [compact, setCompact] = useState(true)

  const filtered = useMemo(() => {
    let list = [...players]
    const q = normalizeForSearch(search.trim())
    if (q) {
      list = list.filter((p) => normalizeForSearch(p.name).includes(q))
    }
    if (positionFilter !== 'all') {
      list = list.filter((p) => p.positions.includes(positionFilter))
    }
    list.sort((a, b) => comparePlayersByStat(a, b, sort))
    return list
  }, [players, search, positionFilter, sort])

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
      <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
        No players match filters.
      </p>
    ) : (
    <div
      className={
        compact
          ? 'divide-y divide-border'
          : 'grid gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'
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
  )

  return (
    <Card aria-labelledby="choices-heading">
      <CardHeader className="pb-2">
        <CardTitle
          id="choices-heading"
          className="font-display text-base text-primary"
        >
          Pick one player ({pickableCount} of {filtered.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="player-search" className="text-xs">
              Search
            </Label>
            <Input
              id="player-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Player name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="position-filter" className="text-xs">
              Position
            </Label>
            <Select
              value={positionFilter}
              onValueChange={(v) =>
                setPositionFilter(v as LineupPosition | 'all')
              }
            >
              <SelectTrigger id="position-filter" className="w-full">
                <SelectValue />
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sort-filter" className="text-xs">
              Sort
            </Label>
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as PlayerStatSortLabel)}
            >
              <SelectTrigger id="sort-filter" className="w-full">
                <SelectValue />
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
          <div className="flex items-end gap-2 pb-0.5">
            <Checkbox
              id="compact-list"
              checked={compact}
              onCheckedChange={(checked) => setCompact(checked === true)}
            />
            <Label htmlFor="compact-list" className="text-xs font-normal">
              Compact list
            </Label>
          </div>
        </div>

        <div className="max-h-[min(42dvh,24rem)] overflow-y-auto rounded-lg border border-border bg-background/50 md:max-h-[min(50vh,480px)]">
          {playerList}
        </div>
      </CardContent>
    </Card>
  )
}
