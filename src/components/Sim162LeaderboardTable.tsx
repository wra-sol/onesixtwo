import { postseasonResultLabel } from '@/lib/sim162-display'
import type { Sim162LeaderboardEntryRow } from '@/lib/sim162-api-client'

type Sim162LeaderboardTableProps = {
  entries: Sim162LeaderboardEntryRow[]
}

const POOL_LABELS: Record<string, string> = {
  live: 'Current MLB',
  legends: 'Legends',
}

export default function Sim162LeaderboardTable({
  entries,
}: Sim162LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No entries yet. Finish a Sim 162 season and submit your initials.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[40rem] text-left text-sm">
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
              Postseason
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Pool
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Run
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
                {entry.wins}-{entry.losses}
                {entry.wonWorldSeries ? ' ★' : ''}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {postseasonResultLabel(entry.postseasonResult)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {POOL_LABELS[entry.pool] ?? entry.pool}
              </td>
              <td className="px-3 py-2">
                {entry.sharePath ? (
                  <a
                    href={entry.sharePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-foreground"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
