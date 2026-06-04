import type { ScoreExplanation, SeasonResult } from '../lib/types'
import { getRosterFormat } from '../lib/roster-format'

type ScoreExplanationPanelProps = {
  result: SeasonResult
  explanation: ScoreExplanation
}

export default function ScoreExplanationPanel({
  result,
  explanation,
}: ScoreExplanationPanelProps) {
  const formatLabel = getRosterFormat(result.rosterFormatId).label

  return (
    <section
      className="rounded-lg border border-border bg-muted/20 p-3 text-left text-sm"
      aria-labelledby="algo-heading"
    >
      <h3 id="algo-heading" className="font-display mb-2 text-base text-primary">
        Why this team played this way
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Roster format: <strong className="text-foreground">{formatLabel}</strong>{' '}
        · Team rating <strong className="text-foreground">{result.teamScore}</strong>
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Offense</dt>
        <dd className="text-right font-semibold tabular-nums">
          {explanation.offenseScore}
        </dd>
        <dt className="text-muted-foreground">Pitching</dt>
        <dd className="text-right font-semibold tabular-nums">
          {explanation.pitchingScore}
        </dd>
        <dt className="text-muted-foreground">Role fit</dt>
        <dd className="text-right font-semibold tabular-nums">
          {explanation.roleFitScore}
        </dd>
        {explanation.defensePenalty > 0 && (
          <>
            <dt className="text-muted-foreground">Fielding penalty</dt>
            <dd className="text-right font-semibold tabular-nums text-destructive">
              −{explanation.defensePenalty}
            </dd>
          </>
        )}
        {explanation.starPowerBonus > 0 && (
          <>
            <dt className="text-muted-foreground">Star bonus</dt>
            <dd className="text-right font-semibold tabular-nums text-primary">
              +{explanation.starPowerBonus}
            </dd>
          </>
        )}
        {explanation.twoWayBonus > 0 && (
          <>
            <dt className="text-muted-foreground">Two-way bonus</dt>
            <dd className="text-right font-semibold tabular-nums text-primary">
              +{explanation.twoWayBonus}
            </dd>
          </>
        )}
        {explanation.speedBonus > 0 && (
          <>
            <dt className="text-muted-foreground">Speed bonus</dt>
            <dd className="text-right font-semibold tabular-nums text-primary">
              +{explanation.speedBonus}
            </dd>
          </>
        )}
      </dl>
      {explanation.riskFactors.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Risk factors:{' '}
          {explanation.riskFactors
            .map((r) => `${r.label} (${r.value})`)
            .join(' · ')}
        </p>
      )}
      {explanation.notes.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {explanation.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
