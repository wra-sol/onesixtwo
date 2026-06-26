import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'
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
        return 'Loading today\u2019s opponent\u2026'
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
              <span className="mt-1 block text-muted-foreground">
                Target {snapshot.targetDate} · Draft from last night&apos;s MLB
                players and play a best-of-3 series.
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
        return 'Loading today\u2019s player pool\u2026'
      case 'error':
        return liveDraftPreview.message
      case 'ready': {
        const { snapshot } = liveDraftPreview
        return (
          <>
            <span className="font-medium text-foreground">
              {formatLiveDraftHomeHeadline(snapshot)}
            </span>
            <span className="mt-1 block text-muted-foreground">
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
    <div className="mx-auto grid max-w-4xl gap-4 pb-20 md:grid-cols-2 md:pb-8">
      <Card className="md:col-span-2">
        <CardHeader className="items-center text-center">
          <img
            src={BRAND.logoPath}
            alt="Perfect Season logo"
            className="mb-2 size-24 rounded-3xl object-cover shadow-xl ring-2 ring-primary/70"
          />
          <CardTitle className="font-display text-2xl text-primary">
            {BRAND.name}
          </CardTitle>
          <CardDescription>{BRAND.description}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            Classic 162
          </CardTitle>
          <CardDescription>
            Spin franchise decades, draft historical cards, simulate a full
            season.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {ROSTER_FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                  formatId === format.id
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50',
                )}
                aria-pressed={formatId === format.id}
                onClick={() => setFormatId(format.id)}
              >
                <span className="block font-bold">{format.label}</span>
              </button>
            ))}
          </div>
          <Button type="button" onClick={() => onStartClassic(formatId)}>
            Start Classic Draft
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            Daily Matchup
          </CardTitle>
          <CardDescription>{dailyMatchupDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyMatchupPlayDisabled ? (
            <p
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-muted-foreground"
              role="status"
            >
              {dailyMatchupPreview.status === 'loading'
                ? 'Loading today\u2019s opponent\u2026'
                : dailyMatchupPreview.status === 'error'
                  ? 'Opponent unavailable'
                  : 'Unavailable today'}
            </p>
          ) : (
            <Link
              to="/daily-matchup"
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Play Daily Matchup
            </Link>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/40 md:col-span-2">
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            Live Draft
          </CardTitle>
          <CardDescription>{liveDraftDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {liveDraftPlayDisabled ? (
            <p
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-muted-foreground"
              role="status"
            >
              {liveDraftPreview.status === 'loading'
                ? 'Loading today\u2019s player pool\u2026'
                : 'Live Draft unavailable'}
            </p>
          ) : (
            <Link
              to="/live-draft"
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground"
            >
              Play Live Draft
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
