import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import LivePlayerCard from '@/components/LivePlayerCard'
import TeamFilter from '@/components/TeamFilter'
import { deriveTeamOptions } from '@/lib/team-options'
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
  getPlayerBadge?: (player: LivePlayer) => string | null
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
  getPlayerBadge,
  onSelect,
}: DailyPlayerBrowserProps) {
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('overall')
  const [hideUnavailable, setHideUnavailable] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')

  const searching = search.trim().length > 0
  const teamOptions = useMemo(() => deriveTeamOptions(players), [players])

  // Team filtering is optional here: an empty selection means "all teams"
  // (position is the primary axis for building a daily lineup). Fall back to
  // all teams if a stale team is no longer in the pool.
  const effectiveTeam =
    teamFilter && teamOptions.some((t) => t.abbrev === teamFilter) ? teamFilter : ''

  const displayPlayers = useMemo(() => {
    const filtered = players.filter((p) => {
      if (!searching && effectiveTeam && p.teamAbbrev !== effectiveTeam) return false
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
  }, [players, positionFilter, hideUnavailable, sortBy, getDisabledReason, effectiveTeam, searching])

  return (
    <div className="space-y-3" data-player-browser="true">
      <TeamFilter
        options={teamOptions}
        value={effectiveTeam}
        onChange={setTeamFilter}
        disabled={!canSelect || searching}
        includeAllOption
        hint={searching ? 'Searching all teams' : undefined}
      />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search all players by name"
        disabled={!canSelect}
      />

      <div className="flex flex-wrap gap-1">
        {FILTER_OPTIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPositionFilter(pos)}
            className={cn(
              'min-h-8 rounded px-2 text-[0.7rem] font-semibold tracking-wide uppercase transition-colors',
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
        <label className="flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={hideUnavailable}
            onChange={(e) => setHideUnavailable(e.target.checked)}
            className="size-4"
          />
          Hide unavailable
        </label>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Sort players"
            className="h-8 rounded border border-border bg-background px-1 text-base md:text-sm"
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
              badge={getPlayerBadge?.(player) ?? null}
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
