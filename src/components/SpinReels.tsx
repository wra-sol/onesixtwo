import type { Era, SpinIntent } from '../lib/types'

type SpinReelsProps = {
  teamName: string
  era: Era
  isSpinning: boolean
  spinIntent: SpinIntent
  teamPreview: string
  eraPreview: Era
}

type ReelProps = {
  label: string
  value: string
  isSpinning: boolean
  locked: boolean
}

function SpinReel({ label, value, isSpinning, locked }: ReelProps) {
  return (
    <div className={`spin-reel${locked ? ' spin-reel--locked' : ''}`}>
      <span className="spin-reel-label">{label}</span>
      <div className="spin-reel-window" aria-hidden={locked}>
        <div
          className={`spin-reel-track${isSpinning && !locked ? ' spin-reel-track--spinning' : ''}`}
        >
          <span className="spin-reel-item">{value}</span>
        </div>
      </div>
    </div>
  )
}

export default function SpinReels({
  teamName,
  era,
  isSpinning,
  spinIntent,
  teamPreview,
  eraPreview,
}: SpinReelsProps) {
  const teamLocked = isSpinning && spinIntent === 'year'
  const eraLocked = isSpinning && spinIntent === 'team'

  return (
    <div className="spin-reels" role="status">
      <SpinReel
        label="Team"
        value={isSpinning && !teamLocked ? teamPreview : teamName}
        isSpinning={isSpinning && !teamLocked}
        locked={teamLocked}
      />
      <SpinReel
        label="Era"
        value={isSpinning && !eraLocked ? eraPreview : era}
        isSpinning={isSpinning && !eraLocked}
        locked={eraLocked}
      />
    </div>
  )
}
