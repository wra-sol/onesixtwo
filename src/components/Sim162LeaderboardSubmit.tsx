import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { readStoredInitials, writeStoredInitials } from '@/lib/leaderboard'
import {
  submitSim162Leaderboard,
  type Sim162SubmitResult,
} from '@/lib/sim162-api-client'
import { trackEvent } from '@/lib/analytics'
import type { PostseasonResult } from '@shared/live/sim162-season'
import type { Sim162Pool } from '@/lib/sim162-share-url'

type Sim162LeaderboardSubmitProps = {
  pool: Sim162Pool
  challengeDate: string
  playerIds: string[]
  battingOrderIds: string[]
  rotationOrderIds: string[]
  simSeed: string
  wins: number
  losses: number
  postseasonResult: PostseasonResult
  wonWorldSeries: boolean
  userQualified: boolean
  disabled?: boolean
  disabledReason?: string
}

export default function Sim162LeaderboardSubmit({
  pool,
  challengeDate,
  playerIds,
  battingOrderIds,
  rotationOrderIds,
  simSeed,
  wins,
  losses,
  postseasonResult,
  wonWorldSeries,
  userQualified,
  disabled = false,
  disabledReason,
}: Sim162LeaderboardSubmitProps) {
  const [initials, setInitials] = useState(() => readStoredInitials())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<Sim162SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInitialsChange = (value: string) => {
    setInitials(value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))
    setError(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    if (disabled || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    setResult(null)

    try {
      const response = await submitSim162Leaderboard({
        pool,
        initials,
        challengeDate,
        playerIds,
        battingOrderIds,
        rotationOrderIds,
        simSeed,
        wins,
        losses,
        postseasonResult,
        wonWorldSeries,
        userQualified,
      })
      if (response.ok) {
        writeStoredInitials(initials)
        setResult(response)
        trackEvent('sim162_leaderboard_submitted', { pool, rank: response.rank })
      } else {
        setError(response.error)
      }
    } catch {
      setError('Could not submit to leaderboard.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (disabled) {
    return (
      <div className="w-full space-y-2 rounded-lg border border-border bg-muted/20 p-4 text-left">
        <h3 className="text-sm font-medium text-primary">Leaderboard</h3>
        <p className="text-xs text-muted-foreground" role="alert">
          {disabledReason ?? 'Submission is unavailable.'}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border bg-muted/20 p-4 text-left">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-primary">Leaderboard</h3>
        <p className="text-xs text-muted-foreground">
          Add your initials to the Sim 162 board. One submission per player.
        </p>
      </div>

      {result?.ok ? (
        <p className="text-sm">
          Submitted —{' '}
          <span className="font-semibold text-primary">#{result.rank}</span> on
          the Sim 162 board.{' '}
          <Link
            to="/leaderboard"
            className="underline underline-offset-2 hover:text-primary"
          >
            View leaderboard
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:max-w-[8rem]">
            <Label htmlFor="sim162-leaderboard-initials">Initials</Label>
            <Input
              id="sim162-leaderboard-initials"
              value={initials}
              onChange={(event) => handleInitialsChange(event.target.value)}
              placeholder="ABC"
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-invalid={Boolean(error)}
              className="text-center font-display text-lg tracking-[0.35em] uppercase"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="sm:mb-0.5"
            disabled={isSubmitting || initials.length < 2}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Submitting…' : 'Submit to leaderboard'}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
