import type { DraftHistoryEntry } from '../lib/types'

type DraftHistoryProps = {
  history: DraftHistoryEntry[]
}

export default function DraftHistory({ history }: DraftHistoryProps) {
  if (history.length === 0) {
    return null
  }

  return (
    <details className="group border-t border-border pt-3 text-sm">
      <summary className="cursor-pointer font-display text-primary marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span
            className="text-muted-foreground transition group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          Draft log ({history.length})
        </span>
      </summary>
      <ol className="mt-2 space-y-0 border-t border-border/60 pt-2">
        {history.map((entry, i) => (
          <li
            key={`${entry.round}-${entry.playerName}-${i}`}
            className="border-b border-border py-2 last:border-b-0"
          >
            <span className="mr-2 font-extrabold text-primary">
              R{entry.round}
            </span>
            <span>
              {entry.playerName} ({entry.position})
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {entry.teamName} · {entry.era}
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}
