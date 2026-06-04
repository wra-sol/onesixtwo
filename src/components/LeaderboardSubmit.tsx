import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trackEvent } from '@/lib/analytics'
import { buildSharePath } from '@/lib/share-url'
import {
  readStoredInitials,
  submitToLeaderboard,
  type SubmitLeaderboardResult,
} from '@/lib/leaderboard'
import type { Lineup, RosterFormatId } from '@/lib/types'

type LeaderboardSubmitProps = {
  lineup: Lineup
  rosterFormatId: RosterFormatId
  rerollIndex: number
}

export default function LeaderboardSubmit({
  lineup,
  rosterFormatId,
  rerollIndex,
}: LeaderboardSubmitProps) {
  const [initials, setInitials] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitLeaderboardResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = rerollIndex === 0

  useEffect(() => {
    setInitials(readStoredInitials())
  }, [])

  const handleInitialsChange = (value: string) => {
    setInitials(value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))
    setError(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    setResult(null)

    try {
      const sharePath = buildSharePath(lineup, 0, rosterFormatId)
      const response = await submitToLeaderboard({ initials, sharePath })
      if (response.ok) {
        setResult(response)
        trackEvent('leaderboard_submit', { rank: response.rank })
      } else {
        setError(response.error)
        trackEvent('leaderboard_submit_error', { error: response.error })
      }
    } catch {
      const message = 'Could not submit to leaderboard.'
      setError(message)
      trackEvent('leaderboard_submit_error', { error: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border bg-muted/20 p-4 text-left">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-primary">Leaderboard</h3>
        <p className="text-xs text-muted-foreground">
          Add your initials to today&apos;s board. First simulation only.
        </p>
      </div>

      {!canSubmit ? (
        <p className="text-xs text-muted-foreground">
          Only your first simulation can be submitted. Draft again for a new
          entry.
        </p>
      ) : result?.ok ? (
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
            <Label htmlFor="leaderboard-initials">Initials</Label>
            <Input
              id="leaderboard-initials"
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
