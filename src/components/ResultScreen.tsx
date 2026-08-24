import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import ShareResultPanel from './ShareResultPanel'
import { BRAND } from '../lib/brand'
import { SIMULATION_EXPLANATION } from '../lib/calibration'
import { buildShareUrl } from '../lib/share-url'
import { getRosterFormat } from '../lib/roster-format'
import type { Lineup, SeasonResult } from '../lib/types'
import RatingBreakdown from './RatingBreakdown'
import ResultStatTables from './ResultStatTables'
import ScoreExplanationPanel from './ScoreExplanationPanel'
import SeasonRecap from './SeasonRecap'
import LeaderboardSubmit from './LeaderboardSubmit'

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

  const shareUrl =
    shareUrlOverride ??
    buildShareUrl(lineup, rerollIndex, result.rosterFormatId)
  const shareTitle = `${BRAND.name}: ${result.record}`
  const shareText = `${shareTitle}\n${result.tier.label}\n${shareUrl}`
  const formatLabel = getRosterFormat(result.rosterFormatId).label

  return (
    <Card
      className="mx-auto max-w-2xl text-center"
      aria-labelledby="result-heading"
    >
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
          {result.identity.label} · {formatLabel} · Rating {result.teamScore}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-left">
        {result.gamesFromPerfect > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {result.gamesFromPerfect} wins short of {BRAND.perfectRecord}
          </p>
        )}
        {result.scorecard && (
          <ResultStatTables scorecard={result.scorecard} />
        )}
        {result.scoreExplanation && (
          <ScoreExplanationPanel
            result={result}
            explanation={result.scoreExplanation}
          />
        )}
        <Separator />
        <div aria-live="polite">
          <SeasonRecap result={result} />
        </div>
        <RatingBreakdown result={result} lineup={lineup} />
        <ShareResultPanel
          shareUrl={shareUrl}
          shareTitle={shareTitle}
          shareText={shareText}
          trackProps={{ record: result.record }}
          restartLabel={readOnly ? 'Draft your own' : 'Draft again'}
          onRestart={onRestart}
        >
          {!readOnly && (
            <LeaderboardSubmit
              lineup={lineup}
              rosterFormatId={result.rosterFormatId}
              rerollIndex={rerollIndex}
            />
          )}
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
        </ShareResultPanel>
      </CardContent>
    </Card>
  )
}
