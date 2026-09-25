import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { BRAND } from '@/lib/brand'
import { GameMark, type GameMarkKind } from '@/components/GameArt'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  fetchDailyMatchupSnapshot,
  fetchLiveDraftSnapshot,
  LiveSnapshotError,
} from '@/lib/live-api-client'
import {
  ROSTER_FORMATS,
  type RosterFormatId,
} from '@/lib/roster-format'
import { cn } from '@/lib/utils'
import { formatDailyMatchupOpponentHeadline } from '@shared/live/daily-matchup-display'
import {
  formatLiveDraftHomeDescription,
  formatLiveDraftHomeHeadline,
} from '@shared/live/live-draft-display'
import type { DailyMatchupSnapshot, LiveDraftSnapshot } from '@shared/live/live-types'

type ModeSelectProps = {
  onStartClassic: (formatId: RosterFormatId) => void
}

type DailyMatchupPreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: DailyMatchupSnapshot }

type LiveDraftPreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: LiveDraftSnapshot }

type ModeCardProps = {
  mark: GameMarkKind
  kicker: string
  title: string
  description: React.ReactNode
  children: React.ReactNode
  className?: string
}

function ModeCard({
  mark,
  kicker,
  title,
  description,
  children,
  className,
}: ModeCardProps) {
  return (
    <Card className={cn('game-mode-card', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="game-mode-card__kicker">{kicker}</p>
            <CardTitle className="font-display text-xl text-primary">{title}</CardTitle>
          </div>
          <GameMark kind={mark} className="size-10 text-primary md:size-12" />
        </div>
        <CardDescription className="max-w-prose text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">{children}</CardContent>
    </Card>
  )
}

function ModeLink({
  to,
  children,
  variant = 'default',
}: {
  to: string
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'outline'
}) {
  return (
    <Link
      to={to}
      className={cn(buttonVariants({ variant, size: 'lg' }), 'w-full')}
    >
      {children}
    </Link>
  )
}

function ModeStatus({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-center text-sm text-muted-foreground"
      role="status"
    >
      {children}
    </p>
  )
}

export default function ModeSelect({ onStartClassic }: ModeSelectProps) {
  const [formatId, setFormatId] = useState<RosterFormatId>('classic')
  const [dailyMatchupPreview, setDailyMatchupPreview] =
    useState<DailyMatchupPreviewState>({ status: 'loading' })
  const [liveDraftPreview, setLiveDraftPreview] = useState<LiveDraftPreviewState>({
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false

    void fetchDailyMatchupSnapshot()
      .then((snapshot) => {
        if (!cancelled) {
          setDailyMatchupPreview({ status: 'ready', snapshot })
        }
      })
      .catch((error) => {
        if (cancelled) return
        const message =
          error instanceof LiveSnapshotError
            ? error.message
            : 'Could not load today\u2019s opponent.'
        setDailyMatchupPreview({ status: 'error', message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void fetchLiveDraftSnapshot()
      .then((snapshot) => {
        if (!cancelled) {
          setLiveDraftPreview({ status: 'ready', snapshot })
        }
      })
      .catch((error) => {
        if (cancelled) return
        const message =
          error instanceof LiveSnapshotError
            ? error.message
            : 'Could not load today\u2019s player pool.'
        setLiveDraftPreview({ status: 'error', message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const dailyMatchupDescription = (() => {
    switch (dailyMatchupPreview.status) {
      case 'loading':
        return 'Loading the opponent and player pool for today.'
      case 'error':
        return dailyMatchupPreview.message
      case 'ready': {
        const { snapshot } = dailyMatchupPreview
        if (snapshot.available && snapshot.opponent) {
          return (
            <>
              <span className="font-medium text-foreground">
                {formatDailyMatchupOpponentHeadline(snapshot)}
              </span>
              <span className="mt-1 block">
                Draft 12 players from Target Date {snapshot.targetDate}, then play a
                best-of-3.
              </span>
            </>
          )
        }
        return formatDailyMatchupOpponentHeadline(snapshot)
      }
      default: {
        const _exhaustive: never = dailyMatchupPreview
        return _exhaustive
      }
    }
  })()

  const liveDraftDescription = (() => {
    switch (liveDraftPreview.status) {
      case 'loading':
        return 'Loading today\u2019s active MLB pool.'
      case 'error':
        return liveDraftPreview.message
      case 'ready': {
        const { snapshot } = liveDraftPreview
        return (
          <>
            <span className="font-medium text-foreground">
              {formatLiveDraftHomeHeadline(snapshot)}
            </span>
            <span className="mt-1 block">
              {formatLiveDraftHomeDescription(snapshot)}
            </span>
          </>
        )
      }
      default: {
        const _exhaustive: never = liveDraftPreview
        return _exhaustive
      }
    }
  })()

  const dailyMatchupPlayDisabled =
    dailyMatchupPreview.status !== 'ready' ||
    !dailyMatchupPreview.snapshot.available
  const liveDraftPlayDisabled = liveDraftPreview.status !== 'ready'

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <section className="game-intro" aria-labelledby="mode-select-heading">
        <img
          src={BRAND.logoPath}
          alt=""
          className="size-16 rounded-xl object-cover ring-2 ring-primary/60 shadow-lg md:size-20"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{BRAND.tagline}</p>
          <h1
            id="mode-select-heading"
            className="mt-1 max-w-2xl font-display text-3xl leading-tight text-foreground md:text-4xl"
          >
            Draft a roster. See what it does over 162 games.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Pick a mode, make the legal selections, and watch the simulation
            decide the season.
          </p>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <ModeCard
          mark="classic"
          kicker="Historical draft"
          title="Classic 162"
          description="Spin a franchise and era, draft its best players, then run a full projected season."
        >
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="Classic roster size"
          >
            {ROSTER_FORMATS.map((format) => (
              <Button
                key={format.id}
                type="button"
                variant="outline"
                className={cn(
                  'h-auto min-h-12 justify-start px-3 py-2 text-left',
                  formatId === format.id &&
                    'border-primary bg-primary/10 text-foreground ring-1 ring-primary',
                )}
                aria-pressed={formatId === format.id}
                onClick={() => setFormatId(format.id)}
              >
                <span className="block text-sm font-semibold">{format.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {format.positions.length} lineup slots
                </span>
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => onStartClassic(formatId)}
          >
            Start classic draft
          </Button>
        </ModeCard>

        <ModeCard
          mark="daily"
          kicker="Yesterday's MLB"
          title="Daily Matchup"
          description={dailyMatchupDescription}
          className="border-primary/45"
        >
          {dailyMatchupPlayDisabled ? (
            <ModeStatus>
              {dailyMatchupPreview.status === 'loading'
                ? 'Loading today\u2019s opponent\u2026'
                : dailyMatchupPreview.status === 'error'
                  ? 'Opponent unavailable'
                  : 'No completed game yesterday'}
            </ModeStatus>
          ) : (
            <ModeLink to="/daily-matchup">Play today&apos;s matchup</ModeLink>
          )}
        </ModeCard>

        <ModeCard
          mark="live"
          kicker="Head-to-head"
          title="Live Draft"
          description={liveDraftDescription}
          className="border-secondary/70"
        >
          {liveDraftPlayDisabled ? (
            <ModeStatus>
              {liveDraftPreview.status === 'loading'
                ? 'Loading today\u2019s player pool\u2026'
                : 'Live Draft unavailable'}
            </ModeStatus>
          ) : (
            <ModeLink to="/live-draft" variant="secondary">
              Draft against the AI
            </ModeLink>
          )}
        </ModeCard>

        <ModeCard
          mark="sim162"
          kicker="Full season"
          title="Sim 162"
          description="Draft 25 players, set the batting order and rotation, then play through the postseason."
          className="border-primary/45"
        >
          <p className="text-xs font-medium text-muted-foreground">
            Choose a player pool
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeLink to="/sim162?pool=live">Current MLB</ModeLink>
            <ModeLink to="/sim162?pool=legends" variant="secondary">
              All-Time Legends
            </ModeLink>
          </div>
        </ModeCard>
      </div>
    </div>
  )
}
