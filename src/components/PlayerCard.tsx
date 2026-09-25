import { cn } from '@/lib/utils'
import { getDisplayPositions } from '../lib/player-eligibility'
import { PlayerRoleGlyph } from './GameArt'
import {
  formatPlayerSlashLine,
  formatPlayerTotals,
} from '../lib/player-stats'
import type { Player } from '../lib/types'

type PlayerCardProps = {
  player: Player
  selected: boolean
  disabled: boolean
  disabledReason?: string | null
  compact?: boolean
  onSelect: () => void
}

export default function PlayerCard({
  player,
  selected,
  disabled,
  disabledReason,
  compact = false,
  onSelect,
}: PlayerCardProps) {
  const displayPositions = getDisplayPositions(player)

  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          'grid min-h-12 w-full grid-cols-[minmax(5.5rem,1fr)_auto] grid-rows-[auto_auto_auto] gap-x-2 gap-y-0.5 border-b border-border bg-transparent px-3 py-2 text-left transition-colors',
          !disabled && 'hover:bg-muted/50',
          selected &&
            'bg-primary/15 shadow-[inset_4px_0_0_var(--primary)] ring-1 ring-primary/40',
          disabled && 'cursor-not-allowed opacity-50 grayscale',
        )}
        disabled={disabled}
        aria-pressed={selected}
        title={disabledReason ?? undefined}
        onClick={onSelect}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <PlayerRoleGlyph role={player.role} className="size-3.5 text-primary/70" />
          <span className="truncate text-sm font-bold">{player.name}</span>
        </span>
        <span className="justify-self-end text-[0.68rem] font-semibold text-primary">
          {displayPositions.join(' · ')}
        </span>
        <span className="col-span-2 text-[0.68rem] tabular-nums text-muted-foreground">
          {formatPlayerSlashLine(player)}
        </span>
        <span className="col-span-2 text-[0.65rem] tabular-nums text-muted-foreground">
          {formatPlayerTotals(player)}
        </span>
        {disabled && disabledReason && (
          <span className="col-span-2 text-[0.65rem] font-medium text-muted-foreground">
            {disabledReason}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full flex-col gap-1 rounded-xl bg-card p-3.5 text-left ring-1 ring-foreground/10 transition-colors',
        !disabled && 'hover:bg-muted/50',
        selected && 'ring-2 ring-primary',
        disabled && 'cursor-not-allowed opacity-50 grayscale',
      )}
      disabled={disabled}
      aria-pressed={selected}
      title={disabledReason ?? undefined}
      onClick={onSelect}
    >
      <span className="flex items-center gap-2 text-base font-bold">
        <PlayerRoleGlyph role={player.role} className="size-4 text-primary/70" />
        {player.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {player.teamName} · {player.era}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatPlayerSlashLine(player)}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatPlayerTotals(player)}
      </span>
      <span className="text-xs font-semibold text-primary">
        {displayPositions.join(' · ')}
      </span>
      {disabled && disabledReason && (
        <span className="text-xs font-medium text-muted-foreground">
          {disabledReason}
        </span>
      )}
    </button>
  )
}
