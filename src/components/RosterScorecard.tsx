import type { RosterScorecard as RosterScorecardData } from '../lib/types'

type RosterScorecardProps = {
  scorecard: RosterScorecardData
}

export default function RosterScorecard({ scorecard }: RosterScorecardProps) {
  return (
    <section aria-labelledby="scorecard-heading">
      <h3
        id="scorecard-heading"
        className="font-display mb-2 text-base text-primary"
      >
        Roster scorecard
      </h3>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {scorecard.rows.map((row) => (
          <li
            key={row.position}
            className="grid grid-cols-[2rem_1fr] gap-x-2 px-3 py-2 text-xs sm:grid-cols-[2.5rem_1fr_auto]"
          >
            <span className="font-extrabold text-primary">{row.position}</span>
            <div className="min-w-0">
              <p className="truncate font-bold">{row.playerName}</p>
              <p className="truncate text-[0.65rem] text-muted-foreground">
                {row.teamName} · {row.era}
              </p>
              <p className="mt-0.5 truncate text-[0.65rem] tabular-nums text-muted-foreground">
                {row.displayStats}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                {row.contributionLabel} — {row.contributionSummary}
              </p>
            </div>
            <div className="col-span-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.65rem] sm:col-span-1 sm:flex-col sm:items-end sm:justify-center">
              <span>
                OVR <strong>{row.overallRating}</strong>
              </span>
              <span className="text-muted-foreground">
                {row.topTrait.label} {row.topTrait.value}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
