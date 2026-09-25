import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TeamOption } from '@/lib/team-options'

type TeamFilterProps = {
  options: TeamOption[]
  value: string
  onChange: (abbrev: string) => void
  disabled?: boolean
  id?: string
  /** Shown as muted helper text next to the select (e.g. why the list is scoped). */
  hint?: string
  /** When true, prepend an "All teams" entry (value "") so filtering is optional. */
  includeAllOption?: boolean
  allOptionLabel?: string
}

const ALL_TEAMS_VALUE = '__all__'

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
  includeAllOption = false,
  allOptionLabel = 'All teams',
}: TeamFilterProps) {
  const hasTeams = options.length > 0
  const selectValue = value || ALL_TEAMS_VALUE
  const selectedLabel = value
    ? (options.find((team) => team.abbrev === value)?.name ?? value)
    : allOptionLabel

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        Team
      </label>
      <Select
        value={selectValue}
        onValueChange={(next) => onChange(next === ALL_TEAMS_VALUE ? '' : (next ?? ''))}
        disabled={disabled || (!hasTeams && !includeAllOption)}
      >
        <SelectTrigger
          id={id}
          className="min-h-11 min-w-0 flex-1"
          aria-label="Filter players by team"
        >
          <SelectValue placeholder="All teams">{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {includeAllOption && (
            <SelectItem value={ALL_TEAMS_VALUE}>{allOptionLabel}</SelectItem>
          )}
          {!hasTeams && !includeAllOption ? (
            <SelectItem value="__none__" disabled>
              No teams
            </SelectItem>
          ) : (
            options.map((team) => (
              <SelectItem key={team.abbrev} value={team.abbrev}>
                {team.name} ({team.count})
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
