import type { DraftBucket } from '../lib/types'

type DraftPanelProps = {
  round: number
  bucket: DraftBucket | null
  statusLabel: string
  isSpinning?: boolean
  spinPreview?: DraftBucket | null
  canRespinTeam?: boolean
  canRespinYear?: boolean
  teamRespinUsed?: boolean
  yearRespinUsed?: boolean
  onRespinTeam?: () => void
  onRespinYear?: () => void
}

export default function DraftPanel({
  round,
  bucket,
  statusLabel,
  isSpinning = false,
  spinPreview = null,
  canRespinTeam = false,
  canRespinYear = false,
  teamRespinUsed = false,
  yearRespinUsed = false,
  onRespinTeam,
  onRespinYear,
}: DraftPanelProps) {
  const display = isSpinning && spinPreview ? spinPreview : bucket
  const showRespins =
    !isSpinning && bucket && (onRespinTeam || onRespinYear)

  return (
    <section className="draft-panel" aria-labelledby="draft-panel-heading">
      <h2 id="draft-panel-heading">The Draft</h2>
      <p className="round-label">
        Round <span className="round-num">{round}</span> of 9
      </p>
      <p className="status-label" aria-live="polite">
        {statusLabel}
      </p>
      {display && (
        <div
          className={`spin-card ${isSpinning ? 'spin-card--active' : ''}`}
          role="status"
        >
          <span className="spin-label">
            {isSpinning ? 'Spinning…' : 'Spin result'}
          </span>
          <p className="spin-team">{display.teamName}</p>
          <p className="spin-era">{display.era}</p>
        </div>
      )}
      {showRespins && (
        <div className="respin-actions">
          <button
            type="button"
            className="btn btn-secondary btn-respin"
            disabled={!canRespinTeam}
            onClick={onRespinTeam}
          >
            {teamRespinUsed ? 'Team respin used' : 'Respin team'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-respin"
            disabled={!canRespinYear}
            onClick={onRespinYear}
          >
            {yearRespinUsed ? 'Year respin used' : 'Respin year'}
          </button>
        </div>
      )}
    </section>
  )
}
