import { AlertTriangle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  DAILY_LINEUP_POSITIONS,
  type DailyLineup,
} from '@shared/live/daily-roster'
import {
  filledSlotCount,
  scarceSlotHints,
  teamUsage,
} from '@shared/live/daily-draft-insights'
import type { LivePlayer } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

type DailyDraftProgressProps = {
  lineup: DailyLineup
  players: LivePlayer[]
  draftedPlayerIds: string[]
  draftedTeamIds: number[]
  opponentTeamId: number
  fallbackWarning: string | null
}

export default function DailyDraftProgress({
  lineup,
  players,
  draftedPlayerIds,
  draftedTeamIds,
  opponentTeamId,
  fallbackWarning,
}: DailyDraftProgressProps) {
  const filled = filledSlotCount(lineup)
  const pct = Math.round((filled / 12) * 100)
  const hints = scarceSlotHints(lineup, players, draftedPlayerIds, opponentTeamId)
  const teams = teamUsage(players, draftedTeamIds, opponentTeamId)
  const usableTeams = teams.filter((t) => !t.isOpponent)

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {fallbackWarning && (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{fallbackWarning} — leaderboard submit is disabled.</span>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm text-primary">Draft progress</p>
          <span className="text-xs tabular-nums text-muted-foreground">{filled}/12</span>
        </div>
        <Progress value={pct} max={100} aria-label={`${filled} of 12 slots filled`} />
      </div>

      <div className="flex flex-wrap gap-1">
        {DAILY_LINEUP_POSITIONS.map((pos) => (
          <span
            key={pos}
            className={cn(
              'rounded px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase',
              lineup[pos]
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {pos}
          </span>
        ))}
      </div>

      {hints.length > 0 && (
        <div className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <p className="font-semibold">Scarce slots</p>
          <ul className="mt-0.5 space-y-0.5">
            {hints.slice(0, 3).map((h) => (
              <li key={h.position}>
                {h.position}: {h.eligibleRemaining} eligible player
                {h.eligibleRemaining === 1 ? '' : 's'} left
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
          Teams · one player per team
        </p>
        <div className="flex flex-wrap gap-1">
          {usableTeams.map((t) => (
            <Badge
              key={t.teamId}
              variant={t.used ? 'default' : 'outline'}
              className={cn('text-[0.6rem]', t.remainingPlayers === 0 && 'opacity-50')}
              title={`${t.remainingPlayers} players available`}
            >
              {t.teamAbbrev}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
