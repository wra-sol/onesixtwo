import { useEffect, useRef } from 'react'
import type { ReplayFrame } from '@/lib/series-replay'
import { cn } from '@/lib/utils'

type PlayFeedProps = {
  frames: ReplayFrame[]
  currentIndex: number
  userTeamLabel: string
  opponentTeamLabel: string
}

function sideAbbrev(label: string, fallback: string): string {
  if (label.length <= 5) return label.slice(0, 3).toUpperCase()
  return fallback
}

function pitcherChangeLabel(role: ReplayFrame['pitcherRole']): string {
  if (role === 'CL') return 'Closer in'
  if (role === 'RP') return 'Reliever in'
  return 'Starter in'
}

export function PlayFeed({
  frames,
  currentIndex,
  userTeamLabel,
  opponentTeamLabel,
}: PlayFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hoveringRef = useRef(false)

  const userAbbr = sideAbbrev(userTeamLabel, 'YOU')
  const oppAbbr = sideAbbrev(opponentTeamLabel, 'OPP')
  const visible = frames.slice(0, Math.max(0, currentIndex + 1))

  useEffect(() => {
    if (hoveringRef.current) return
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [currentIndex])

  return (
    <div
      ref={containerRef}
      className="broadcast-feed"
      aria-live="polite"
      onMouseEnter={() => {
        hoveringRef.current = true
      }}
      onMouseLeave={() => {
        hoveringRef.current = false
      }}
    >
      {visible.map((frame) => {
        const arrow = frame.half === 'top' ? '▲' : '▼'
        const sideLabel =
          frame.battingSide === 'user' ? userAbbr : oppAbbr
        return (
          <div
            key={frame.eventIndex}
            className={cn(
              'broadcast-feed-item',
              frame.isHighlight && 'broadcast-feed-item--highlight',
              frame.isWalkOff && 'broadcast-feed-item--walkoff',
            )}
          >
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              {frame.inning}
              {arrow}
            </span>
            <span className="font-semibold text-foreground">{sideLabel}</span>
            <span className="min-w-0 flex-1 text-foreground">{frame.description}</span>
            {frame.runsScoredOnPlay > 0 && (
              <span className="font-bold text-primary">
                +{frame.runsScoredOnPlay} RBI
              </span>
            )}
            {frame.isPitcherChange && (
              <span className="broadcast-chip">
                {pitcherChangeLabel(frame.pitcherRole)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
