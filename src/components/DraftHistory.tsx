import { Separator } from '@/components/ui/separator'
import type { DraftHistoryEntry } from '../lib/types'

type DraftHistoryProps = {
  history: DraftHistoryEntry[]
}

export default function DraftHistory({ history }: DraftHistoryProps) {
  if (history.length === 0) {
    return null
  }

  return (
    <section className="pt-2" aria-labelledby="history-heading">
      <Separator className="mb-4" />
      <h3
        id="history-heading"
        className="font-display mb-2 text-base text-primary"
      >
        Draft log
      </h3>
      <ol className="max-h-[200px] space-y-0 overflow-y-auto text-sm">
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
    </section>
  )
}
