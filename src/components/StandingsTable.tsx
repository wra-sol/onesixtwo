import type { Standings } from '@shared/live/league-standings'
import { cn } from '@/lib/utils'

type StandingsTableProps = {
  standings: Standings
  userLeague: 'AL' | 'NL'
  userTeamId: string
  playoffSeeds: Map<string, number>
  teamNameById: Map<string, string>
}

function LeagueTable({
  league,
  rows,
  userTeamId,
  playoffSeeds,
  teamNameById,
}: {
  league: 'AL' | 'NL'
  rows: Standings['records']
  userTeamId: string
  playoffSeeds: Map<string, number>
  teamNameById: Map<string, string>
}) {
  return (
    <section aria-label={`${league} standings`}>
      <h4 className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-primary">
        {league}
      </h4>
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-muted-foreground">
            <th scope="col" className="py-1 pl-2 pr-1 font-semibold">
              Team
            </th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">
              W
            </th>
            <th scope="col" className="py-1 pl-1 pr-2 text-right font-semibold">
              L
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const seed = playoffSeeds.get(r.teamId)
            const isUser = r.teamId === userTeamId
            return (
              <tr
                key={r.teamId}
                className={cn(
                  'border-b border-border/50 last:border-b-0',
                  isUser && 'bg-primary/5 font-medium',
                )}
              >
                <td className="py-1 pl-2 pr-1">
                  <span className="inline-flex items-center gap-1.5">
                    {seed != null && (
                      <span
                        className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-primary/15 px-0.5 text-[0.6rem] font-bold tabular-nums text-primary"
                        title={`Playoff seed #${seed}`}
                      >
                        {seed}
                      </span>
                    )}
                    <span
                      className={cn(
                        'max-w-[9rem] truncate',
                        !isUser && !seed && 'text-muted-foreground',
                      )}
                    >
                      {teamNameById.get(r.teamId) ?? r.teamId}
                    </span>
                    {isUser && <span className="text-primary">(You)</span>}
                  </span>
                </td>
                <td className="px-1 py-1 text-right tabular-nums">{r.wins}</td>
                <td className="py-1 pl-1 pr-2 text-right tabular-nums">
                  {r.losses}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export default function StandingsTable({
  standings,
  userLeague,
  userTeamId,
  playoffSeeds,
  teamNameById,
}: StandingsTableProps) {
  const leagues: Array<'AL' | 'NL'> =
    userLeague === 'AL' ? ['AL', 'NL'] : ['NL', 'AL']
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {leagues.map((lg) => (
        <LeagueTable
          key={lg}
          league={lg}
          rows={standings.byLeague[lg]}
          userTeamId={userTeamId}
          playoffSeeds={playoffSeeds}
          teamNameById={teamNameById}
        />
      ))}
    </div>
  )
}
