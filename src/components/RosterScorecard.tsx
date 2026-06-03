import type { RosterScorecard as RosterScorecardData } from '../lib/types'
import { SIMULATED_SEASON_STAT_NOTE } from '../lib/player-stats'

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
        Season stat lines
      </h3>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {scorecard.rows.map((row) => (
          <li
            key={row.position}
            className="grid grid-cols-[2rem_1fr] gap-x-2 px-3 py-2 text-xs sm:grid-cols-[2.5rem_1fr]"
          >
            <span className="font-extrabold text-primary">{row.position}</span>
            <div className="min-w-0">
              <p className="truncate font-bold">{row.playerName}</p>
              <p className="truncate text-[0.65rem] text-muted-foreground">
                {row.teamName} · {row.era}
              </p>
              <p className="mt-0.5 truncate text-[0.68rem] tabular-nums text-foreground">
                {row.slashLine}
              </p>
              <p className="mt-0.5 truncate text-[0.68rem] tabular-nums text-muted-foreground">
                {row.countingLine}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-center text-[0.65rem] text-muted-foreground">
        {scorecard.rows[0]?.statNote ?? SIMULATED_SEASON_STAT_NOTE}
      </p>
    </section>
  )
}
