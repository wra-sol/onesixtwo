import type { TeamOption } from '@/lib/team-options'

type TeamFilterProps = {
  options: TeamOption[]
  value: string
  onChange: (abbrev: string) => void
  disabled?: boolean
  id?: string
  /** Shown as muted helper text next to the select (e.g. why the list is scoped). */
  hint?: string
}

/**
 * Team picker that scopes a draft browser to a single team's players,
 * mirroring how Classic mode's spin reveals one franchise at a time.
 */
export default function TeamFilter({
  options,
  value,
  onChange,
  disabled = false,
  id = 'team-filter',
  hint,
}: TeamFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Team
      </label>
      <select
        id={id}
        aria-label="Filter players by team"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || options.length === 0}
        className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 text-sm"
      >
        {options.length === 0 ? (
          <option value="">No teams</option>
        ) : (
          options.map((t) => (
            <option key={t.abbrev} value={t.abbrev}>
              {t.name} ({t.count})
            </option>
          ))
        )}
      </select>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
