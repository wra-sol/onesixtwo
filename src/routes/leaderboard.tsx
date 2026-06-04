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
import { cn } from '@/lib/utils'
import {
  fetchLeaderboard,
  LEADERBOARD_PERIOD_LABELS,
  type LeaderboardEntryRow,
  type LeaderboardPeriod,
} from '@/lib/leaderboard'

const PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'all']

export default function LeaderboardRoute() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [entries, setEntries] = useState<LeaderboardEntryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = useCallback(async (nextPeriod: LeaderboardPeriod) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchLeaderboard(nextPeriod)
      setEntries(response.entries)
    } catch (err) {
      setEntries([])
      setError(
        err instanceof Error ? err.message : 'Could not load leaderboard.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEntries(period)
  }, [period, loadEntries])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl text-primary">
            Leaderboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Top runs ranked by wins, then rating. Submit your initials after a
            draft.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-wrap justify-center gap-2"
            role="tablist"
            aria-label="Leaderboard period"
          >
            {PERIODS.map((value) => (
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
                onClick={() => void loadEntries(period)}
              >
                Retry
              </Button>
            </div>
          ) : (
            <LeaderboardTable entries={entries} />
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link
              to="/"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Draft your lineup
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
