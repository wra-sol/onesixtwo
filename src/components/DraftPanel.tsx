import type { DraftBucket } from '../lib/types'

type DraftPanelProps = {
  round: number
  bucket: DraftBucket | null
  statusLabel: string
}

export default function DraftPanel({
  round,
  bucket,
  statusLabel,
}: DraftPanelProps) {
  return (
    <section className="draft-panel" aria-labelledby="draft-panel-heading">
      <h2 id="draft-panel-heading">The Draft</h2>
      <p className="round-label">
        Round <span className="round-num">{round}</span> of 9
      </p>
      <p className="status-label" aria-live="polite">
        {statusLabel}
      </p>
      {bucket && (
        <div className="spin-card" role="status">
          <span className="spin-label">Spin result</span>
          <p className="spin-team">{bucket.teamName}</p>
          <p className="spin-era">{bucket.era}</p>
        </div>
      )}
    </section>
  )
}
