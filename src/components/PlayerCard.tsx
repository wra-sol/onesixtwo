import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getPlayerCategories } from '../lib/game'
import type { PlayerCategoryLabel } from '../lib/game'
import type { HitterStats, PitcherStats, Player } from '../lib/types'

type PlayerCardProps = {
  player: Player
  selected: boolean
  disabled: boolean
  disabledReason?: string | null
  compact?: boolean
  sortCategory?: PlayerCategoryLabel
  onSelect: () => void
}

function formatStats(player: Player): string {
  if (player.role === 'pitcher') {
    const s = player.stats as PitcherStats
    return `ERA ${s.era} · WHIP ${s.whip} · ${s.so} K · ${s.wins} W`
  }
  const s = player.stats as HitterStats
  return `AVG ${s.avg} · ${s.hr} HR · ${s.rbi} RBI · OPS ${s.ops}`
}

function CategoryChips({
  player,
  sortCategory,
  compact,
}: {
  player: Player
  sortCategory?: PlayerCategoryLabel
  compact: boolean
}) {
  const categories = getPlayerCategories(player)
  return (
    <div
      className={cn(
        'flex flex-wrap gap-1',
        compact ? 'mt-0' : 'mt-1',
      )}
    >
      {categories.map((category) => (
        <Badge
          key={category.label}
          variant={sortCategory === category.label ? 'default' : 'secondary'}
          className="h-auto gap-1 px-1.5 py-0.5 text-[0.65rem] font-normal"
        >
          <span className="text-[0.6rem] tracking-wide uppercase">
            {category.label}
          </span>
          <span className="font-bold">{category.value}</span>
        </Badge>
      ))}
    </div>
  )
}

export default function PlayerCard({
  player,
  selected,
  disabled,
  disabledReason,
  compact = false,
  sortCategory,
  onSelect,
}: PlayerCardProps) {
  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          'grid w-full min-h-9 grid-cols-[minmax(5.5rem,1fr)_auto] grid-rows-[auto_auto] gap-x-2 gap-y-0.5 border-b border-border bg-transparent px-3 py-2 text-left transition-colors',
          !disabled && 'hover:bg-muted/50',
          selected && 'bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]',
          disabled && 'cursor-not-allowed opacity-50 grayscale',
        )}
        disabled={disabled}
        aria-pressed={selected}
        title={disabledReason ?? undefined}
        onClick={onSelect}
      >
        <span className="truncate text-sm font-bold">{player.name}</span>
        <span className="justify-self-end text-[0.68rem] font-semibold text-primary">
          {player.positions.join(' · ')}
        </span>
        <div className="col-span-2">
          <CategoryChips player={player} sortCategory={sortCategory} compact />
        </div>
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
      <span className="text-base font-bold">{player.name}</span>
      <span className="text-xs text-muted-foreground">
        {player.teamName} · {player.era}
      </span>
      <span className="text-xs text-muted-foreground">{formatStats(player)}</span>
      <span className="text-xs font-semibold text-primary">
        {player.positions.join(' · ')}
      </span>
      <CategoryChips player={player} sortCategory={sortCategory} compact={false} />
      {disabled && disabledReason && (
        <span className="text-xs font-medium text-muted-foreground">
          {disabledReason}
        </span>
      )}
    </button>
  )
}
