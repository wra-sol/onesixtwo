import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DAILY_LINEUP_POSITIONS,
  type DailyLineupPosition,
} from '@shared/live/daily-roster'
import GradeChip from '@/components/GradeChip'
import type { OpponentRoster } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

type DailyOpponentPreviewProps = {
  opponent: OpponentRoster
  opponentGameScore: { runs: number; hits: number; runDiff: number }
}

function gradeChip(label: string, value: number | undefined) {
  return <GradeChip label={label} value={value} />
}

export default function DailyOpponentPreview({
  opponent,
  opponentGameScore,
}: DailyOpponentPreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const filled = DAILY_LINEUP_POSITIONS.filter((pos) => opponent.lineup[pos]).length

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div>
          <p className="font-display text-sm text-primary">Opponent · {opponent.teamName}</p>
          <p className="text-xs text-muted-foreground">
            {opponentGameScore.runs} runs · {opponentGameScore.hits} hits · run diff{' '}
            {opponentGameScore.runDiff > 0 ? '+' : ''}
            {opponentGameScore.runDiff}
          </p>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {filled}/12 known
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {DAILY_LINEUP_POSITIONS.map((pos) => {
            const player = opponent.lineup[pos as DailyLineupPosition]
            return (
              <div
                key={pos}
                className={cn(
                  'rounded-md border border-border p-1.5',
                  !player && 'bg-muted/20',
                )}
              >
                <p className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  {pos}
                </p>
                {player ? (
                  <div className="space-y-0.5">
                    <p className="truncate text-xs font-medium">{player.name}</p>
                    <div className="flex flex-wrap gap-x-2">
                      {player.role === 'hitter' ? (
                        <>
                          {gradeChip('C', player.grades.contact)}
                          {gradeChip('P', player.grades.power)}
                          {gradeChip('D', player.grades.defense)}
                        </>
                      ) : (
                        <>
                          {gradeChip('St', player.grades.stuff)}
                          {gradeChip('Cm', player.grades.command)}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[0.65rem] text-muted-foreground">—</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!expanded && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.values(opponent.lineup)
            .filter((p): p is NonNullable<typeof p> => Boolean(p))
            .slice(0, 6)
            .map((p) => (
              <Badge key={p.id} variant="secondary" className="text-[0.65rem]">
                {p.name}
              </Badge>
            ))}
        </div>
      )}
    </div>
  )
}
