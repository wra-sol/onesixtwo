import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { trackEvent } from '../lib/analytics'
import { BRAND } from '../lib/brand'
import { SIMULATION_EXPLANATION } from '../lib/calibration'
import { buildShareUrl } from '../lib/share-url'
import { LINEUP_POSITIONS, type Lineup, type SeasonResult } from '../lib/types'
import RatingBreakdown from './RatingBreakdown'
import RosterScorecard from './RosterScorecard'
import SeasonRecap from './SeasonRecap'

type ResultScreenProps = {
  result: SeasonResult
  lineup: Lineup
  onRestart: () => void
  onSimulateAgain?: () => void
  isSimulating?: boolean
  readOnly?: boolean
  shareUrl?: string
  rerollIndex?: number
}

const canNativeShare =
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export default function ResultScreen({
  result,
  lineup,
  onRestart,
  onSimulateAgain,
  isSimulating = false,
  readOnly = false,
  shareUrl: shareUrlOverride,
  rerollIndex = 0,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false)
  const [showShareText, setShowShareText] = useState(false)

  const shareUrl =
    shareUrlOverride ?? buildShareUrl(lineup, rerollIndex)
  const shareTitle = `${BRAND.name}: ${result.record}`
  const shareText = `${shareTitle}\n${result.tier.label}\n${shareUrl}`

  const handleCopy = async () => {
    setShowShareText(false)
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      trackEvent('share_copied', { record: result.record })
      window.setTimeout(() => setCopied(false), 2000)
      return
    } catch {
      setCopied(false)
    }
    setShowShareText(true)
  }

  const handleShare = async () => {
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
      trackEvent('native_share_opened', { record: result.record })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      await handleCopy()
    }
  }

  return (
    <Card className="mx-auto max-w-lg text-center" aria-labelledby="result-heading">
      <CardHeader>
        <CardTitle
          id="result-heading"
          className="font-display text-xl text-primary"
        >
          {readOnly ? 'Shared season result' : 'Season result'}
        </CardTitle>
        <p
          className={cn(
            'font-display text-5xl font-bold',
            result.isPerfectSeason && 'result-record--perfect',
          )}
          aria-live="polite"
        >
          {result.record}
        </p>
        <p className="text-base">{result.headline}</p>
        <p className="text-sm font-medium text-primary">{result.tier.label}</p>
        <p className="text-xs text-muted-foreground">
          {result.identity.label}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-left">
        {result.gamesFromPerfect > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {result.gamesFromPerfect} wins short of {BRAND.perfectRecord}
          </p>
        )}
        <div aria-live="polite">
          <SeasonRecap result={result} />
        </div>
        <RatingBreakdown result={result} />
        <Separator />
        {result.scorecard ? (
          <RosterScorecard scorecard={result.scorecard} />
        ) : (
          <div>
            <h3 className="font-display mb-2 text-base text-primary">
              Your lineup
            </h3>
            <ul className="grid grid-cols-3 gap-1.5 text-xs">
              {LINEUP_POSITIONS.map((pos) => {
                const player = lineup[pos]
                return (
                  <li key={pos} className="rounded-md bg-muted/50 px-2 py-1.5">
                    <span className="block text-[0.7rem] font-extrabold text-primary">
                      {pos}
                    </span>
                    <span className="block truncate">{player?.name ?? '—'}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
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
        {showShareText && (
          <div className="space-y-2 text-left">
            <p className="text-xs text-muted-foreground">
              Copy did not work in this browser. Select the text below:
            </p>
            <textarea
              readOnly
              className="h-28 w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-xs leading-relaxed"
              value={shareText}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-3 border-t-0 bg-transparent">
        {!readOnly && onSimulateAgain && (
          <div className="w-full space-y-1.5 text-center">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isSimulating}
              onClick={onSimulateAgain}
            >
              {isSimulating ? 'Simulating season…' : 'Simulate again'}
            </Button>
            <p className="text-[0.65rem] text-muted-foreground">
              {SIMULATION_EXPLANATION}
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {canNativeShare && (
            <Button type="button" variant="outline" onClick={handleShare}>
              Share
            </Button>
          )}
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
          <Button type="button" onClick={onRestart}>
            {readOnly ? 'Draft your own' : 'Draft again'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
