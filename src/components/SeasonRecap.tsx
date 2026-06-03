import { formatLuckDelta } from '../lib/recap'
import type { SeasonResult } from '../lib/types'

type SeasonRecapProps = {
  result: SeasonResult
}

export default function SeasonRecap({ result }: SeasonRecapProps) {
  return (
    <section aria-labelledby="recap-heading" className="space-y-3">
      <h3 id="recap-heading" className="font-display text-base text-primary">
        Season recap
      </h3>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <p className="font-medium">{result.identity.label}</p>
        <p className="text-xs text-muted-foreground">
          {result.identity.description}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <dt className="text-muted-foreground">Expected</dt>
          <dd className="font-bold tabular-nums">
            {result.expectedWins} wins
          </dd>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <dt className="text-muted-foreground">Variance</dt>
          <dd className="font-bold tabular-nums">
            {formatLuckDelta(result.luckDelta)}
          </dd>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <dt className="text-muted-foreground">Win streak</dt>
          <dd className="font-bold tabular-nums">
            {result.simulation.longestWinStreak}
          </dd>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <dt className="text-muted-foreground">Close games</dt>
          <dd className="font-bold tabular-nums">
            {result.simulation.closeGameRecord}
          </dd>
        </div>
      </dl>
      <ul className="space-y-1.5 text-sm">
        {result.seasonMoments.map((moment, index) => (
          <li
            key={`${moment.text}-${index}`}
            className="flex gap-2 text-left"
          >
            <span className="text-primary" aria-hidden>
              •
            </span>
            <span>{moment.text}</span>
          </li>
        ))}
      </ul>
      {result.bestPlayer && (
        <div className="rounded-lg border border-border px-3 py-2 text-sm">
          <p>
            <span className="font-semibold text-primary">MVP</span>{' '}
            {result.bestPlayer.name} ({result.bestPlayer.position}) —{' '}
            {result.bestPlayer.highlightCategory.label}{' '}
            {result.bestPlayer.highlightCategory.value}
          </p>
        </div>
      )}
      {result.weakestPlayer && (
        <div className="rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold">Weakest link</span>{' '}
            {result.weakestPlayer.name} ({result.weakestPlayer.position}) —{' '}
            {result.weakestPlayer.highlightCategory.label}{' '}
            {result.weakestPlayer.highlightCategory.value}
          </p>
        </div>
      )}
    </section>
  )
}
