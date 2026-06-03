import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import type { DraftBucket, Era, SpinIntent } from '../lib/types'
import SpinReels from './SpinReels'

type DraftPanelProps = {
  round: number
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

function teamRespinLabel(used: boolean, canRespin: boolean): string {
  if (used) return 'Respin team · Used'
  if (canRespin) return 'Respin team · 1 left'
  return 'Respin team'
}

function yearRespinLabel(used: boolean, canRespin: boolean): string {
  if (used) return 'Respin year · Used'
  if (canRespin) return 'Respin year · 1 left'
  return 'Respin year'
}

export default function DraftPanel({
  round,
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

  const showSpinCard = isSpinning || bucket !== null
  const teamName = bucket?.teamName ?? teamPreview
  const era = bucket?.era ?? eraPreview

  return (
    <Card aria-labelledby="draft-panel-heading">
      <CardHeader className="pb-2">
        <CardTitle
          id="draft-panel-heading"
          className="font-display text-primary"
        >
          The Draft
        </CardTitle>
        <Progress value={(round / 9) * 100} max={100} className="gap-1.5">
          <ProgressLabel className="text-sm text-muted-foreground">
            Round {round} of 9
          </ProgressLabel>
          <ProgressValue />
        </Progress>
        <p className="text-sm italic text-muted-foreground" aria-live="polite">
          {statusLabel}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showSpinCard && (
          <div
            className={`spin-card ${isSpinning ? 'spin-card--active' : ''}`}
            aria-live={spinResultAnnouncement ? 'polite' : undefined}
          >
            <span className="mb-2 block text-xs tracking-widest text-muted-foreground uppercase">
              {isSpinning ? 'Spinning…' : 'Spin result'}
            </span>
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
              className="min-w-32 flex-1"
              disabled={!canRespinTeam}
              onClick={onRespinTeam}
            >
              {teamRespinLabel(teamRespinUsed, canRespinTeam)}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-w-32 flex-1"
              disabled={!canRespinYear}
              onClick={onRespinYear}
            >
              {yearRespinLabel(yearRespinUsed, canRespinYear)}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
