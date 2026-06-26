import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import LiveResultScreen from '@/components/LiveResultScreen'
import {
  fetchDailyMatchupSnapshot,
  fetchLiveDraftSnapshot,
} from '@/lib/live-api-client'
import {
  buildLiveSharePath,
  isParsedLiveShare,
  liveShareValidationMessage,
  parseLiveShareParams,
} from '@shared/live/live-share-url'
import { simulateLiveShare } from '@shared/live/live-share-sim'
import type { LiveShareInput, SimulatedSeries } from '@shared/live/live-types'

type ResolvedLiveShare = {
  series: SimulatedSeries
  opponentName: string
  shareInput: LiveShareInput
}

type LiveShareContentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; resolved: ResolvedLiveShare }

async function resolveLiveShare(input: LiveShareInput): Promise<ResolvedLiveShare | null> {
  const snapshot =
    input.mode === 'daily-matchup'
      ? await fetchDailyMatchupSnapshot(input.challengeDate)
      : await fetchLiveDraftSnapshot(input.challengeDate)
  const resolved = simulateLiveShare(input, snapshot)
  if (!resolved) {
    return null
  }
  return {
    series: resolved.series,
    opponentName: resolved.opponentName,
    shareInput: input,
  }
}

function LiveShareUnavailable({
  message,
  actionHref,
  actionLabel,
}: {
  message: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <div className="py-2">
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle className="font-display text-xl text-primary">
            Share link unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Link
            to={actionHref}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
          >
            {actionLabel}
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function LiveShareContent({ input }: { input: LiveShareInput }) {
  const navigate = useNavigate()
  const [state, setState] = useState<LiveShareContentState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    void resolveLiveShare(input)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setState({ status: 'error', message: 'This share link could not be loaded.' })
          return
        }
        setState({ status: 'ready', resolved: result })
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', message: 'This share link could not be loaded.' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [input])

  if (state.status === 'loading') {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Loading shared result…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <LiveShareUnavailable
        message={state.message}
        actionHref={input.mode === 'daily-matchup' ? '/daily-matchup' : '/live-draft'}
        actionLabel="Play your own"
      />
    )
  }

  return (
    <LiveResultScreen
        series={state.resolved.series}
        opponentName={state.resolved.opponentName}
        shareInput={state.resolved.shareInput}
        readOnly
        onRestart={() =>
          navigate(input.mode === 'daily-matchup' ? '/daily-matchup' : '/live-draft')
        }
      />
  )
}

export default function LiveShareRoute() {
  const [searchParams] = useSearchParams()
  const parsed = useMemo(
    () => parseLiveShareParams(searchParams),
    [searchParams],
  )

  if (!isParsedLiveShare(parsed)) {
    return (
      <LiveShareUnavailable
        message={liveShareValidationMessage(parsed)}
        actionHref="/daily-matchup"
        actionLabel="Play Daily Matchup"
      />
    )
  }

  return (
    <LiveShareContent
      key={buildLiveSharePath(parsed)}
      input={parsed}
    />
  )
}
