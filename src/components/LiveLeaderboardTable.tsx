import type { LiveLeaderboardEntryRow } from '@/lib/live-api-client'

type LiveLeaderboardTableProps = {
  entries: LiveLeaderboardEntryRow[]
}

export default function LiveLeaderboardTable({
  entries,
}: LiveLeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No entries yet. Finish a live mode run and submit your initials.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Rank
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Initials
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Series
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Runs
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Diff
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={`${entry.initials}-${entry.createdAt}-${index}`}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {index + 1}
              </td>
              <td className="px-3 py-2 font-display text-base tracking-widest">
                {entry.initials}
              </td>
              <td className="px-3 py-2 font-display font-semibold tabular-nums">
                {entry.seriesWins}-{entry.seriesLosses}
                {entry.wonSeries ? ' W' : ' L'}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {entry.userRuns}-{entry.opponentRuns}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {entry.runDiff > 0 ? '+' : ''}
                {entry.runDiff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
