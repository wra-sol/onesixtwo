import type { SimulatedSeries } from '@shared/live/live-types'
import type { HeadlineMoment, PerformerStat } from '@/lib/series-replay'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type SeriesRecapProps = {
  series: SimulatedSeries
  opponentName: string
  userTeamLabel: string
  opponentTeamLabel: string
  userStars: PerformerStat[]
  opponentStars: PerformerStat[]
  headline: HeadlineMoment
  readOnly: boolean
}

function formatStarLine(p: PerformerStat): string {
  const parts: string[] = []
  if (p.homeRuns > 0) parts.push(`${p.homeRuns} HR`)
  if (p.rbi > 0) parts.push(`${p.rbi} RBI`)
  if (p.hits > 0) parts.push(`${p.hits} H`)
  if (parts.length === 0) parts.push('0 H')
  return `${p.name} — ${parts.join(', ')}`
}

export function SeriesRecap({
  series,
  opponentName,
  userTeamLabel,
  opponentTeamLabel,
  userStars,
  opponentStars,
  headline,
  readOnly,
}: SeriesRecapProps) {
  const title = readOnly
    ? 'Shared series result'
    : series.wonSeries
      ? 'Series win'
      : 'Series loss'
  const titleColor = readOnly
    ? 'text-primary'
    : series.wonSeries
      ? 'text-primary'
      : 'text-destructive'

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="items-center text-center">
        <CardTitle className={cn('font-display text-xl', titleColor)}>
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {userTeamLabel} {series.userWins}-{series.opponentWins} vs {opponentName}{' '}
          · Runs {series.userRuns}-{series.opponentRuns}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <figure className="border-l-4 border-primary pl-3">
          <figcaption className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Headline moment
          </figcaption>
          <blockquote className="mt-1 italic text-foreground">
            {headline.description}
          </blockquote>
        </figure>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Your stars</h3>
          {userStars.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No standout performances.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {userStars.map((p) => (
                <li key={p.name}>{formatStarLine(p)}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {opponentTeamLabel} stars
          </h3>
          {opponentStars.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No standout performances.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {opponentStars.map((p) => (
                <li key={p.name}>{formatStarLine(p)}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
