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
import { BRAND } from '../lib/brand'
import { LINEUP_POSITIONS, type Lineup, type SeasonResult } from '../lib/types'
import RatingBreakdown from './RatingBreakdown'

type ResultScreenProps = {
  result: SeasonResult
  lineup: Lineup
  onRestart: () => void
}

export default function ResultScreen({
  result,
  lineup,
  onRestart,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false)
  const [showShareText, setShowShareText] = useState(false)

  const handleCopy = async () => {
    setShowShareText(false)
    try {
      await navigator.clipboard.writeText(result.shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      return
    } catch {
      setCopied(false)
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: BRAND.name,
          text: result.shareText,
          url: BRAND.url,
        })
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }

    setShowShareText(true)
  }

  return (
    <Card className="mx-auto max-w-lg text-center" aria-labelledby="result-heading">
      <CardHeader>
        <CardTitle
          id="result-heading"
          className="font-display text-xl text-primary"
        >
          Season result
        </CardTitle>
        <p
          className={cn(
            'font-display text-5xl font-bold',
            result.isPerfectSeason && 'result-record--perfect',
          )}
        >
          {result.record}
        </p>
        <p className="text-base">{result.headline}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-left">
        {result.gamesFromPerfect > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {result.gamesFromPerfect} wins short of {BRAND.perfectRecord}
          </p>
        )}
        {result.bestPlayer && (
          <p className="text-center text-sm">
            MVP: {result.bestPlayer.name} ({result.bestPlayer.position}) —{' '}
            {result.bestPlayer.highlightCategory.label}{' '}
            {result.bestPlayer.highlightCategory.value}
          </p>
        )}
        {result.weakestPlayer && (
          <p className="text-center text-sm text-muted-foreground">
            Weakest link: {result.weakestPlayer.name} (
            {result.weakestPlayer.position}) —{' '}
            {result.weakestPlayer.highlightCategory.label}{' '}
            {result.weakestPlayer.highlightCategory.value}
          </p>
        )}
        <RatingBreakdown result={result} />
        <Separator />
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
        {showShareText && (
          <div className="space-y-2 text-left">
            <p className="text-xs text-muted-foreground">
              Copy did not work in this browser. Select the text below:
            </p>
            <textarea
              readOnly
              className="h-20 w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              value={result.shareText}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-center gap-3 border-t-0 bg-transparent">
        <Button type="button" variant="outline" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy result'}
        </Button>
        <Button type="button" onClick={onRestart}>
          Draft again
        </Button>
      </CardFooter>
    </Card>
  )
}
