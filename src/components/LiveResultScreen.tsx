import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { buildLiveSharePath, liveSharePageTitle } from '@shared/live/live-share-url'
import type { LiveShareInput, SimulatedSeries } from '@shared/live/live-types'
import { trackEvent } from '@/lib/analytics'
import { BRAND } from '@/lib/brand'

type LiveResultScreenProps = {
  series: SimulatedSeries
  opponentName: string
  onRestart: () => void
  submitSlot?: React.ReactNode
  shareInput?: LiveShareInput
  readOnly?: boolean
}

const canNativeShare =
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export default function LiveResultScreen({
  series,
  opponentName,
  onRestart,
  submitSlot,
  shareInput,
  readOnly = false,
}: LiveResultScreenProps) {
  const [revealedGames, setRevealedGames] = useState(1)
  const [copied, setCopied] = useState(false)
  const [showShareText, setShowShareText] = useState(false)

  const sharePath = shareInput ? buildLiveSharePath(shareInput) : null
  const shareUrl =
    sharePath && typeof window !== 'undefined'
      ? `${window.location.origin}${sharePath}`
      : sharePath
  const shareTitle = shareInput
    ? `${BRAND.name}: ${liveSharePageTitle(shareInput.mode, series, opponentName)}`
    : `${BRAND.name}: ${series.userWins}-${series.opponentWins} vs ${opponentName}`
  const shareText = shareUrl ? `${shareTitle}\n${shareUrl}` : shareTitle

  const handleCopy = async () => {
    if (!shareUrl) return
    setShowShareText(false)
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      trackEvent('share_copied', {
        ...(shareInput ? { mode: shareInput.mode } : {}),
        record: `${series.userWins}-${series.opponentWins}`,
      })
      window.setTimeout(() => setCopied(false), 2000)
      return
    } catch {
      setCopied(false)
    }
    setShowShareText(true)
  }

  const handleShare = async () => {
    if (!shareUrl) return
    if (!canNativeShare) {
      await handleCopy()
      return
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      })
      trackEvent('native_share_opened', {
        ...(shareInput ? { mode: shareInput.mode } : {}),
        record: `${series.userWins}-${series.opponentWins}`,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      await handleCopy()
    }
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader className="text-center">
        <CardTitle className="font-display text-xl text-primary">
          {readOnly ? 'Shared series result' : series.wonSeries ? 'Series win' : 'Series loss'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          You {series.userWins}-{series.opponentWins} vs {opponentName} · Runs{' '}
          {series.userRuns}-{series.opponentRuns}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {series.games.slice(0, revealedGames).map((game, index) => {
          const userScore = game.userWasHome ? game.homeScore : game.awayScore
          const oppScore = game.userWasHome ? game.awayScore : game.homeScore
          return (
            <div
              key={`game-${index}`}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <p className="font-semibold">
                Game {index + 1}: You {userScore}, {opponentName} {oppScore}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-primary">
                  Play-by-play
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {game.events.slice(-40).map((event, eventIndex) => (
                    <li key={`${index}-${eventIndex}`}>
                      {event.inning}{event.half === 'top' ? '↑' : '↓'} {event.description}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )
        })}

        {revealedGames < series.games.length && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevealedGames((count) => count + 1)}
          >
            Reveal next game
          </Button>
        )}

        {shareUrl && (
          <details className="group rounded-lg border border-border bg-muted/30 text-left">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span
                  className="text-muted-foreground transition group-open:rotate-90"
                  aria-hidden
                >
                  ▸
                </span>
                Preview share text
              </span>
            </summary>
            <pre className="max-h-40 overflow-y-auto border-t border-border/60 px-3 py-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {shareText}
            </pre>
          </details>
        )}

        {showShareText && shareUrl && (
          <div className="space-y-2 text-left">
            <p className="text-xs text-muted-foreground">
              Copy did not work in this browser. Select the text below:
            </p>
            <textarea
              readOnly
              className="h-28 w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-xs leading-relaxed"
              value={shareText}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}

        {!readOnly && submitSlot}

        <div className="flex flex-wrap justify-center gap-2">
          {shareUrl && canNativeShare && (
            <Button type="button" variant="outline" onClick={() => void handleShare()}>
              Share
            </Button>
          )}
          {shareUrl && (
            <Button type="button" variant="outline" onClick={() => void handleCopy()}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          )}
          <Button type="button" onClick={onRestart}>
            {readOnly ? 'Play your own' : 'Play again'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = '/leaderboard'
            }}
          >
            Leaderboard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
