import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type ScoreboardProps = {
  userTeamLabel: string
  opponentTeamLabel: string
  userScore: number
  opponentScore: number
  inning: number
  half: 'top' | 'bottom'
  outs: number
  pitcherRole: 'SP' | 'RP' | 'CL'
  pitcherName: string
  batterName: string
}

export function Scoreboard({
  userTeamLabel,
  opponentTeamLabel,
  userScore,
  opponentScore,
  inning,
  half,
  outs,
  pitcherRole,
  pitcherName,
  batterName,
}: ScoreboardProps) {
  const prevScoreRef = useRef({ user: userScore, opponent: opponentScore })
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    const prev = prevScoreRef.current
    if (prev.user !== userScore || prev.opponent !== opponentScore) {
      prevScoreRef.current = { user: userScore, opponent: opponentScore }
      setPulsing(true)
      const id = window.setTimeout(() => setPulsing(false), 500)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [userScore, opponentScore])

  const halfArrow = half === 'top' ? '▲' : '▼'
  const halfLabel = `${half === 'top' ? 'Top' : 'Bot'} ${inning}`

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'broadcast-scoreboard',
          pulsing && 'broadcast-scoreboard--pulse',
        )}
      >
        <div className="flex flex-col items-start leading-tight">
          <span className="text-xs text-muted-foreground">{userTeamLabel}</span>
          <span className="text-xl font-bold tabular-nums">{userScore}</span>
        </div>

        <div className="flex flex-col items-center leading-tight">
          <span className="text-sm font-semibold text-primary">
            {halfLabel} {halfArrow}
          </span>
          <div className="mt-1 flex items-center gap-1" aria-label={`${outs} out`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  'broadcast-out-dot',
                  i < outs && 'broadcast-out-dot--filled',
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end leading-tight">
          <span className="text-xs text-muted-foreground">{opponentTeamLabel}</span>
          <span className="text-xl font-bold tabular-nums">{opponentScore}</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {pitcherName}
          <span className="broadcast-chip">{pitcherRole}</span>
        </span>
        <span>At bat: {batterName}</span>
      </div>
    </div>
  )
}
