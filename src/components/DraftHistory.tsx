import type { DraftHistoryEntry } from '../lib/types'

type DraftHistoryProps = {
  history: DraftHistoryEntry[]
}

export default function DraftHistory({ history }: DraftHistoryProps) {
  if (history.length === 0) {
    return null
  }

  return (
    <section className="draft-history" aria-labelledby="history-heading">
      <h3 id="history-heading">Draft log</h3>
      <ol className="draft-history-list">
        {history.map((entry, i) => (
          <li key={`${entry.round}-${entry.playerName}-${i}`}>
            <span className="draft-history-round">R{entry.round}</span>
            <span className="draft-history-pick">
              {entry.playerName} ({entry.position})
            </span>
            <span className="draft-history-meta">
              {entry.teamName} · {entry.era}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
