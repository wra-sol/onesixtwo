import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import LeaderboardTable from '@/components/LeaderboardTable'
import LiveLeaderboardTable from '@/components/LiveLeaderboardTable'
import Sim162LeaderboardTable from '@/components/Sim162LeaderboardTable'
import { cn } from '@/lib/utils'
import {
  fetchLeaderboard,
  LEADERBOARD_PERIOD_LABELS,
  type LeaderboardEntryRow,
  type LeaderboardPeriod,
} from '@/lib/leaderboard'
import {
  challengeDate,
  fetchLiveLeaderboard,
  type LiveLeaderboardEntryRow,
} from '@/lib/live-api-client'
import {
  fetchSim162Leaderboard,
  type Sim162LeaderboardEntryRow,
} from '@/lib/sim162-api-client'
import type { LiveModeId } from '@shared/live/live-types'

type BoardKind = 'classic' | 'sim162' | LiveModeId

const CLASSIC_PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'all']

type BoardConfig =
  | {
      kind: 'classic'
      label: string
      description: string
      load: (period: LeaderboardPeriod) => Promise<LeaderboardEntryRow[]>
      render: (entries: LeaderboardEntryRow[]) => React.ReactNode
    }
  | {
      kind: 'sim162'
      label: string
      description: string
      load: () => Promise<Sim162LeaderboardEntryRow[]>
      render: (entries: Sim162LeaderboardEntryRow[]) => React.ReactNode
    }
  | {
      kind: LiveModeId
      label: string
      description: string
      load: (date: string) => Promise<LiveLeaderboardEntryRow[]>
      render: (entries: LiveLeaderboardEntryRow[]) => React.ReactNode
    }

const BOARDS: Record<BoardKind, BoardConfig> = {
  classic: {
    kind: 'classic',
    label: 'Classic 162',
    description: 'Top classic runs ranked by wins, then rating.',
    load: async (period) => (await fetchLeaderboard(period)).entries,
    render: (entries) => (
      <LeaderboardTable entries={entries as LeaderboardEntryRow[]} />
    ),
  },
  sim162: {
    kind: 'sim162',
    label: 'Sim 162',
    description: 'Sim 162 seasons ranked by World Series wins, then regular-season record.',
    load: async () => (await fetchSim162Leaderboard()).entries,
    render: (entries) => (
      <Sim162LeaderboardTable entries={entries as Sim162LeaderboardEntryRow[]} />
    ),
  },
  'daily-matchup': {
    kind: 'daily-matchup',
    label: 'Daily Matchup',
    description: 'Live modes ranked by series result, run differential, and runs.',
    load: async (date) => (await fetchLiveLeaderboard('daily-matchup', date)).entries,
    render: (entries) => (
      <LiveLeaderboardTable entries={entries as LiveLeaderboardEntryRow[]} />
    ),
  },
  'live-draft': {
    kind: 'live-draft',
    label: 'Live Draft',
    description: 'Live modes ranked by series result, run differential, and runs.',
    load: async (date) => (await fetchLiveLeaderboard('live-draft', date)).entries,
    render: (entries) => (
      <LiveLeaderboardTable entries={entries as LiveLeaderboardEntryRow[]} />
    ),
  },
}

export default function LeaderboardRoute() {
  const [board, setBoard] = useState<BoardKind>('classic')
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [classicEntries, setClassicEntries] = useState<LeaderboardEntryRow[]>([])
  const [liveEntries, setLiveEntries] = useState<LiveLeaderboardEntryRow[]>([])
  const [sim162Entries, setSim162Entries] = useState<Sim162LeaderboardEntryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const challengeDateValue = useMemo(() => challengeDate(), [])
  const activeBoard = BOARDS[board]
  const loadIdRef = useRef(0)

  const loadBoard = useCallback(async () => {
    const loadId = ++loadIdRef.current
    setIsLoading(true)
    setError(null)
    try {
      if (activeBoard.kind === 'classic') {
        const entries = await activeBoard.load(period)
        if (loadId !== loadIdRef.current) return
        setClassicEntries(entries)
      } else if (activeBoard.kind === 'sim162') {
        const entries = await activeBoard.load()
        if (loadId !== loadIdRef.current) return
        setSim162Entries(entries)
      } else {
        const entries = await activeBoard.load(challengeDateValue)
        if (loadId !== loadIdRef.current) return
        setLiveEntries(entries)
      }
    } catch (err) {
      if (loadId !== loadIdRef.current) return
      if (activeBoard.kind === 'classic') setClassicEntries([])
      else if (activeBoard.kind === 'sim162') setSim162Entries([])
      else setLiveEntries([])
      setError(err instanceof Error ? err.message : 'Could not load leaderboard.')
    } finally {
      if (loadId === loadIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [activeBoard, challengeDateValue, period])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on tab change
    void loadBoard()
  }, [loadBoard])

  return (
    <Card className="mx-auto max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl text-primary">
            Leaderboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">{activeBoard.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-wrap justify-center gap-2"
            role="tablist"
            aria-label="Leaderboard board"
          >
            {(Object.entries(BOARDS) as [BoardKind, BoardConfig][]).map(
              ([value, config]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={board === value ? 'default' : 'outline'}
                  role="tab"
                  aria-selected={board === value}
                  className={cn(board !== value && 'bg-transparent')}
                  onClick={() => setBoard(value)}
                >
                  {config.label}
                </Button>
              ),
            )}
          </div>

          {board === 'classic' && (
            <div
              className="flex flex-wrap justify-center gap-2"
              role="tablist"
              aria-label="Leaderboard period"
            >
              {CLASSIC_PERIODS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={period === value ? 'default' : 'outline'}
                  role="tab"
                  aria-selected={period === value}
                  className={cn(period !== value && 'bg-transparent')}
                  onClick={() => setPeriod(value)}
                >
                  {LEADERBOARD_PERIOD_LABELS[value]}
                </Button>
              ))}
            </div>
          )}

          {board !== 'classic' && board !== 'sim162' && (
            <p className="text-center text-xs text-muted-foreground">
              {activeBoard.label} · Challenge date {challengeDateValue}
            </p>
          )}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading leaderboard…
            </p>
          ) : error ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadBoard()}>
                Retry
              </Button>
            </div>
          ) : activeBoard.kind === 'classic' ? (
            activeBoard.render(classicEntries)
          ) : activeBoard.kind === 'sim162' ? (
            activeBoard.render(sim162Entries)
          ) : (
            activeBoard.render(liveEntries)
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link
              to="/"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Choose a game mode
            </Link>
          </p>
        </CardContent>
      </Card>
  )
}
