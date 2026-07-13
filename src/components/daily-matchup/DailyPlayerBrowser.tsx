import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import LivePlayerCard from '@/components/LivePlayerCard'
import {
  DAILY_LINEUP_POSITIONS,
  playerEligibleForDailyPosition,
  type DailyLineupPosition,
} from '@shared/live/daily-roster'
import type { LivePlayer } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

export type PositionFilter = 'ALL' | DailyLineupPosition
export type SortKey = 'overall' | 'name' | 'team'

type DailyPlayerBrowserProps = {
  players: LivePlayer[]
  search: string
  setSearch: (value: string) => void
  selectedPlayer: LivePlayer | null
  canSelect: boolean
  getDisabledReason: (player: LivePlayer) => string | null
  onSelect: (player: LivePlayer) => void
}

const FILTER_OPTIONS: PositionFilter[] = ['ALL', ...DAILY_LINEUP_POSITIONS]

export default function DailyPlayerBrowser({
  players,
  search,
  setSearch,
  selectedPlayer,
  canSelect,
  getDisabledReason,
  onSelect,
}: DailyPlayerBrowserProps) {
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('overall')
  const [hideUnavailable, setHideUnavailable] = useState(false)

  const displayPlayers = useMemo(() => {
    const filtered = players.filter((p) => {
      if (positionFilter !== 'ALL' && !playerEligibleForDailyPosition(p, positionFilter)) {
        return false
      }
      if (hideUnavailable && getDisabledReason(p)) return false
      return true
    })
    const sorted = [...filtered]
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'team') {
      sorted.sort(
        (a, b) => a.teamAbbrev.localeCompare(b.teamAbbrev) || b.grades.overall - a.grades.overall,
      )
    } else {
      sorted.sort((a, b) => b.grades.overall - a.grades.overall)
    }
    return sorted
  }, [players, positionFilter, hideUnavailable, sortBy, getDisabledReason])

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players"
        disabled={!canSelect}
      />

      <div className="flex flex-wrap gap-1">
        {FILTER_OPTIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPositionFilter(pos)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase transition-colors',
              positionFilter === pos
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={hideUnavailable}
            onChange={(e) => setHideUnavailable(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Hide unavailable
        </label>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-7 rounded border border-border bg-background px-1 text-xs"
          >
            <option value="overall">Overall</option>
            <option value="name">Name</option>
            <option value="team">Team</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {displayPlayers.length} player{displayPlayers.length === 1 ? '' : 's'}
      </p>

      <div className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {displayPlayers.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No players match these filters.
          </p>
        ) : (
          displayPlayers.map((player) => (
            <LivePlayerCard
              key={player.id}
              player={player}
              selected={selectedPlayer?.id === player.id}
              disabled={!canSelect || Boolean(getDisabledReason(player))}
              disabledReason={!canSelect ? 'Wait for your turn' : getDisabledReason(player)}
              onSelect={() => onSelect(player)}
              compact
            />
          ))
        )}
      </div>
    </div>
  )
}
