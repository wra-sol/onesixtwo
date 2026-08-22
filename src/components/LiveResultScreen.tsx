import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import SeriesBroadcast from '@/components/SeriesBroadcast'
import { buildLiveSharePath, liveSharePageTitle } from '@shared/live/live-share-url'
import type { LiveShareInput, SimulatedSeries } from '@shared/live/live-types'
import { useShareActions } from '@/hooks/useShareActions'
import { BRAND } from '@/lib/brand'

type LiveResultScreenProps = {
  series: SimulatedSeries
  opponentName: string
  onRestart: () => void
  submitSlot?: React.ReactNode
  shareInput?: LiveShareInput
  readOnly?: boolean
}


export default function LiveResultScreen({
  series,
  opponentName,
  onRestart,
  submitSlot,
  shareInput,
  readOnly = false,
}: LiveResultScreenProps) {

  const sharePath = shareInput ? buildLiveSharePath(shareInput) : null
  const shareUrl =
    sharePath && typeof window !== 'undefined'
      ? `${window.location.origin}${sharePath}`
      : sharePath
  const shareTitle = shareInput
    ? `${BRAND.name}: ${liveSharePageTitle(shareInput.mode, series, opponentName)}`
    : `${BRAND.name}: ${series.userWins}-${series.opponentWins} vs ${opponentName}`
  const shareText = shareUrl ? `${shareTitle}\n${shareUrl}` : shareTitle

  const {
    canNativeShare,
    copied,
    showShareText,
    share: handleShare,
    copy: handleCopy,
  } = useShareActions(shareUrl, shareTitle, shareText, {
    ...(shareInput ? { mode: shareInput.mode } : {}),
    record: `${series.userWins}-${series.opponentWins}`,
  })

  const actions = (
    <Card className="mx-auto max-w-3xl">
      <CardContent className="space-y-4 pt-6">
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

  return (
    <SeriesBroadcast
      series={series}
      opponentName={opponentName}
      readOnly={readOnly}
      actions={actions}
    />
  )
}
