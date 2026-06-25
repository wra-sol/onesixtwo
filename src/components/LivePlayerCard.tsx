import { cn } from '@/lib/utils'
import { continuousToDisplayGrade, GRADE_LABELS } from '@/lib/live-grades'
import type { LivePlayer } from '@/lib/live-types'

type LivePlayerCardProps = {
  player: LivePlayer
  selected?: boolean
  disabled?: boolean
  disabledReason?: string | null
  onSelect?: () => void
  compact?: boolean
}

function gradeLine(label: string, value: number | undefined) {
  if (value === undefined) return null
  const display = continuousToDisplayGrade(value)
  return (
    <span className="text-xs text-muted-foreground">
      {label} {display} {GRADE_LABELS[display]}
    </span>
  )
}

export default function LivePlayerCard({
  player,
  selected,
  disabled,
  disabledReason,
  onSelect,
  compact,
}: LivePlayerCardProps) {
  const overall = continuousToDisplayGrade(player.grades.overall)

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'w-full px-3 py-2 text-left transition-colors',
        selected && 'bg-primary/10',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/40',
        compact && 'py-1.5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{player.name}</p>
          <p className="text-xs text-muted-foreground">
            {player.teamAbbrev} · {player.positions.join('/')}
            {player.isFallback ? ' · Active fallback' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg text-primary">{overall}</p>
          <p className="text-[0.65rem] text-muted-foreground">
            {GRADE_LABELS[overall]}
          </p>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {player.role === 'hitter' ? (
          <>
            {gradeLine('Contact', player.grades.contact)}
            {gradeLine('Power', player.grades.power)}
            {gradeLine('Speed', player.grades.speed)}
            {gradeLine('Defense', player.grades.defense)}
          </>
        ) : (
          <>
            {gradeLine('Stuff', player.grades.stuff)}
            {gradeLine('Command', player.grades.command)}
            {gradeLine('Stamina', player.grades.stamina)}
          </>
        )}
      </div>
      {disabledReason && (
        <p className="mt-1 text-xs text-destructive">{disabledReason}</p>
      )}
    </button>
  )
}
