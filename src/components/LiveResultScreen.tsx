import {
  Card,
  CardContent,
} from '@/components/ui/card'
import SeriesBroadcast from '@/components/SeriesBroadcast'
import ShareResultPanel from '@/components/ShareResultPanel'
import { buildLiveSharePath, liveSharePageTitle } from '@shared/live/live-share-url'
import type { LiveShareInput, SimulatedSeries } from '@shared/live/live-types'
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

  const actions = (
    <Card className="mx-auto max-w-3xl">
      <CardContent className="space-y-4 pt-6">
        <ShareResultPanel
          shareUrl={shareUrl}
          shareTitle={shareTitle}
          shareText={shareText}
          trackProps={{
            ...(shareInput ? { mode: shareInput.mode } : {}),
            record: `${series.userWins}-${series.opponentWins}`,
          }}
          restartLabel={readOnly ? 'Play your own' : 'Play again'}
          onRestart={onRestart}
          showLeaderboard
        >
          {!readOnly && submitSlot}
        </ShareResultPanel>
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
