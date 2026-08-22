import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Sim162ResultScreen from '@/components/Sim162ResultScreen'
import { fetchSim162Snapshot } from '@/lib/sim162-snapshot'
import {
  buildSim162SharePath,
  isParsedSim162Share,
  parseSim162ShareParams,
  sim162ShareValidationMessage,
  type Sim162ShareInput,
} from '@/lib/sim162-share-url'
import { buildSim162Season } from '@shared/live/sim162-season'
import type { Sim162SeasonResult } from '@shared/live/sim162-season'
import {
  roster25FromPlayerIds,
  roster25IsComplete,
} from '@shared/live/roster25'
import { sim162SeasonSeed } from '@shared/live/seeds'
import type { LivePlayer } from '@shared/live/live-types'
import type { Sim162Snapshot } from '@shared/live/sim162-snapshot'

type ResolvedSim162Share = {
  result: Sim162SeasonResult
  shareInput: Sim162ShareInput
}

type Sim162ShareContentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; resolved: ResolvedSim162Share }

async function resolveSim162Share(
  input: Sim162ShareInput,
): Promise<ResolvedSim162Share | null> {
  const snapshot: Sim162Snapshot = await fetchSim162Snapshot(
    input.pool,
    input.challengeDate,
  )
  const playersById = new Map(snapshot.players.map((p) => [p.id, p]))
  const roster = roster25FromPlayerIds(input.playerIds, playersById)
  if (!roster25IsComplete(roster)) {
    return null
  }
  const battingOrder = input.battingOrderIds
    .map((id) => playersById.get(id))
    .filter((player): player is LivePlayer => Boolean(player))
  const rotationOrder = input.rotationOrderIds
    .map((id) => playersById.get(id))
    .filter((player): player is LivePlayer => Boolean(player))

  if (battingOrder.length !== 9 || rotationOrder.length !== 5) {
    return null
  }

  const seasonSeed = sim162SeasonSeed(roster, input.simSeed)
  const result = buildSim162Season(
    roster,
    battingOrder,
    rotationOrder,
    snapshot,
    seasonSeed,
  )
  return { result, shareInput: input }
}

function Sim162ShareUnavailable({
  message,
}: {
  message: string
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
            to="/sim162"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
          >
            Play your own
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function Sim162ShareContent({ input }: { input: Sim162ShareInput }) {
  const navigate = useNavigate()
  const [state, setState] = useState<Sim162ShareContentState>({
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false

    void resolveSim162Share(input)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setState({
            status: 'error',
            message: 'This share link could not be loaded.',
          })
          return
        }
        setState({ status: 'ready', resolved: result })
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'This share link could not be loaded.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [input])

  if (state.status === 'loading') {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Loading shared season…
      </p>
    )
  }

  if (state.status === 'error') {
    return <Sim162ShareUnavailable message={state.message} />
  }

  return (
    <Sim162ResultScreen
      result={state.resolved.result}
      shareInput={state.resolved.shareInput}
      readOnly
      onRestart={() => navigate('/sim162')}
    />
  )
}

export default function Sim162ShareRoute() {
  const [searchParams] = useSearchParams()
  const parsed = useMemo(
    () => parseSim162ShareParams(searchParams),
    [searchParams],
  )

  if (!isParsedSim162Share(parsed)) {
    return (
      <Sim162ShareUnavailable
        message={sim162ShareValidationMessage(parsed)}
      />
    )
  }

  return (
    <Sim162ShareContent
      key={buildSim162SharePath(parsed)}
      input={parsed}
    />
  )
}
