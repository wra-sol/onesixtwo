import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { readStoredInitials, writeStoredInitials } from '@/lib/leaderboard'
import { lineupPlayerIdsFromDailyLineup } from '@shared/live/live-lineup-ids'
import {
  submitLiveLeaderboard,
  type LiveSubmitResult,
} from '@/lib/live-api-client'
import type { LiveModeId } from '@shared/live/live-types'
import type { DailyLineup } from '@shared/live/daily-roster'

type LiveLeaderboardSubmitProps = {
  mode: LiveModeId
  challengeDate: string
  targetDate?: string
  userLineup: DailyLineup
  userBattingOrderIds: string[]
  aiLineup?: DailyLineup
  simSeed: string
  disabled?: boolean
  disabledReason?: string
}

export default function LiveLeaderboardSubmit({
  mode,
  challengeDate,
  targetDate,
  userLineup,
  userBattingOrderIds,
  aiLineup,
  simSeed,
  disabled = false,
  disabledReason,
}: LiveLeaderboardSubmitProps) {
  const [initials, setInitials] = useState(() => readStoredInitials())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<LiveSubmitResult | null>(null)
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
      const response = await submitLiveLeaderboard({
        mode,
        challengeDate,
        targetDate,
        initials,
        playerIds: lineupPlayerIdsFromDailyLineup(userLineup),
        battingOrderIds: userBattingOrderIds,
        aiPlayerIds: aiLineup ? lineupPlayerIdsFromDailyLineup(aiLineup) : undefined,
        simSeed,
      })
      if (response.ok) {
        writeStoredInitials(initials)
        setResult(response)
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
          Add your initials to today&apos;s board. First submission only.
        </p>
      </div>

      {result?.ok ? (
        <p className="text-sm">
          Submitted —{' '}
          <span className="font-semibold text-primary">#{result.rank}</span> on
          today&apos;s board.{' '}
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
            <Label htmlFor="live-leaderboard-initials">Initials</Label>
            <Input
              id="live-leaderboard-initials"
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
