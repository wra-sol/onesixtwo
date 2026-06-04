import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { DraftBucket, Era, SpinIntent } from '../lib/types'
import SpinReels from './SpinReels'

type DraftPanelProps = {
  round: number
  /** Active roster slot count (9–11 depending on format). */
  totalRounds: number
  bucket: DraftBucket | null
  statusLabel: string
  isSpinning?: boolean
  spinIntent?: SpinIntent
  teamPreview?: string
  eraPreview?: Era
  spinResultAnnouncement?: string
  canRespinTeam?: boolean
  canRespinYear?: boolean
  teamRespinUsed?: boolean
  yearRespinUsed?: boolean
  onRespinTeam?: () => void
  onRespinYear?: () => void
}

export default function DraftPanel({
  round,
  totalRounds,
  bucket,
  statusLabel,
  isSpinning = false,
  spinIntent = 'round',
  teamPreview = '',
  eraPreview = '1960s',
  spinResultAnnouncement = '',
  canRespinTeam = false,
  canRespinYear = false,
  teamRespinUsed = false,
  yearRespinUsed = false,
  onRespinTeam,
  onRespinYear,
}: DraftPanelProps) {
  const showRespins =
    !isSpinning && bucket && (onRespinTeam || onRespinYear)

  const progressPct = Math.min(
    100,
    Math.round((round / Math.max(1, totalRounds)) * 100),
  )

  const showSpin = isSpinning || bucket !== null
  const teamName = bucket?.teamName ?? teamPreview
  const era = bucket?.era ?? eraPreview

  return (
    <header className="space-y-3" aria-labelledby="draft-panel-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="draft-panel-heading"
            className="font-display text-lg leading-tight text-primary"
          >
            Round {round} of {totalRounds}
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {statusLabel}
          </p>
        </div>
        <div
          className="flex w-28 shrink-0 flex-col items-end gap-1"
          role="group"
          aria-label={`Draft progress: round ${round} of ${totalRounds}`}
        >
          <span className="text-xs tabular-nums text-muted-foreground">
            {round}/{totalRounds}
          </span>
          <Progress
            value={progressPct}
            max={100}
            className="w-full"
            aria-hidden
          />
        </div>
      </div>

      {showSpin && (
        <div
          className={
            isSpinning ? 'spin-card spin-card--active' : 'spin-card'
          }
          aria-live={spinResultAnnouncement ? 'polite' : undefined}
        >
          <SpinReels
            teamName={teamName}
            era={era}
            isSpinning={isSpinning}
            spinIntent={spinIntent}
            teamPreview={teamPreview || teamName}
            eraPreview={eraPreview}
          />
          {spinResultAnnouncement && !isSpinning && (
            <span className="sr-only">{spinResultAnnouncement}</span>
          )}
        </div>
      )}

      {showRespins && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={!canRespinTeam}
            onClick={onRespinTeam}
            title={
              teamRespinUsed
                ? 'Team respin used'
                : canRespinTeam
                  ? 'One team respin left'
                  : undefined
            }
          >
            {teamRespinUsed ? 'Team · used' : canRespinTeam ? 'Team · 1×' : 'Team'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={!canRespinYear}
            onClick={onRespinYear}
            title={
              yearRespinUsed
                ? 'Year respin used'
                : canRespinYear
                  ? 'One year respin left'
                  : undefined
            }
          >
            {yearRespinUsed ? 'Year · used' : canRespinYear ? 'Year · 1×' : 'Year'}
          </Button>
        </div>
      )}
    </header>
  )
}
