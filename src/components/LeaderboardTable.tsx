import { cn } from '@/lib/utils'
import { getRosterFormat } from '@/lib/roster-format'
import type { LeaderboardEntryRow } from '@/lib/leaderboard'

type LeaderboardTableProps = {
  entries: LeaderboardEntryRow[]
}

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`
}

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No entries yet. Finish a draft and submit your initials.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Rank
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Initials
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Record
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Rating
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Format
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Run
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const record = formatRecord(entry.wins, entry.losses)
            const formatLabel = getRosterFormat(entry.rosterFormatId).label
            return (
              <tr
                key={`${entry.sharePath}-${entry.createdAt}-${index}`}
                className="border-b border-border/60 last:border-b-0"
              >
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="px-3 py-2 font-display text-base tracking-widest">
                  {entry.initials}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 font-display font-semibold tabular-nums',
                    entry.isPerfectSeason && 'result-record--perfect',
                  )}
                >
                  {record}
                </td>
                <td className="px-3 py-2 tabular-nums">{entry.teamScore}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatLabel}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={entry.sharePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-foreground"
                  >
                    View
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
