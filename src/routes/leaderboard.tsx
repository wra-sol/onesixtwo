import { useCallback, useEffect, useState } from 'react'
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
import { cn } from '@/lib/utils'
import {
  fetchLeaderboard,
  LEADERBOARD_PERIOD_LABELS,
  type LeaderboardEntryRow,
  type LeaderboardPeriod,
} from '@/lib/leaderboard'
import {
  fetchLiveLeaderboard,
  type LiveLeaderboardEntryRow,
} from '@/lib/live-api-client'
import type { LiveModeId } from '@/lib/live-types'

type BoardKind = 'classic' | LiveModeId

const CLASSIC_PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'all']

export default function LeaderboardRoute() {
  const [board, setBoard] = useState<BoardKind>('classic')
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [classicEntries, setClassicEntries] = useState<LeaderboardEntryRow[]>(
    [],
  )
  const [liveEntries, setLiveEntries] = useState<LiveLeaderboardEntryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const challengeDate = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  })

  const loadClassic = useCallback(async (nextPeriod: LeaderboardPeriod) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchLeaderboard(nextPeriod)
      setClassicEntries(response.entries)
    } catch (err) {
      setClassicEntries([])
      setError(
        err instanceof Error ? err.message : 'Could not load leaderboard.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadLive = useCallback(async (mode: LiveModeId) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchLiveLeaderboard(mode, challengeDate)
      setLiveEntries(response.entries)
    } catch (err) {
      setLiveEntries([])
      setError(
        err instanceof Error ? err.message : 'Could not load leaderboard.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [challengeDate])

  useEffect(() => {
    if (board === 'classic') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load on tab change
      void loadClassic(period)
    } else {
      void loadLive(board)
    }
  }, [board, period, loadClassic, loadLive])

  const boardLabel =
    board === 'classic'
      ? 'Classic 162'
      : board === 'daily-matchup'
        ? 'Daily Matchup'
        : 'Live Draft'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl text-primary">
            Leaderboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {board === 'classic'
              ? 'Top classic runs ranked by wins, then rating.'
              : 'Live modes ranked by series result, run differential, and runs.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-wrap justify-center gap-2"
            role="tablist"
            aria-label="Leaderboard board"
          >
            {(
              [
                ['classic', 'Classic 162'],
                ['daily-matchup', 'Daily Matchup'],
                ['live-draft', 'Live Draft'],
              ] as const
            ).map(([value, label]) => (
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
                {label}
              </Button>
            ))}
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

          {board !== 'classic' && (
            <p className="text-center text-xs text-muted-foreground">
              {boardLabel} · Challenge date {challengeDate}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  board === 'classic'
                    ? void loadClassic(period)
                    : void loadLive(board)
                }
              >
                Retry
              </Button>
            </div>
          ) : board === 'classic' ? (
            <LeaderboardTable entries={classicEntries} />
          ) : (
            <LiveLeaderboardTable entries={liveEntries} />
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
    </div>
  )
}
