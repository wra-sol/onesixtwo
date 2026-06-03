import { useState } from 'react'
import { LINEUP_POSITIONS, type Lineup, type SeasonResult } from '../lib/types'
import RatingBreakdown from './RatingBreakdown'

type ResultScreenProps = {
  result: SeasonResult
  lineup: Lineup
  onRestart: () => void
}

export default function ResultScreen({
  result,
  lineup,
  onRestart,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="result-screen" aria-labelledby="result-heading">
      <h2 id="result-heading">Season result</h2>
      <p
        className={`result-record ${result.isPerfectSeason ? 'result-record--perfect' : ''}`}
      >
        {result.record}
      </p>
      <p className="result-headline">{result.headline}</p>
      {result.gamesFromPerfect > 0 && (
        <p className="result-distance">
          {result.gamesFromPerfect} wins short of 162-0
        </p>
      )}
      {result.bestPlayer && (
        <p className="result-highlight">
          MVP: {result.bestPlayer.name} ({result.bestPlayer.position}) — OVR{' '}
          {result.bestPlayer.overall}
        </p>
      )}
      {result.weakestPlayer && (
        <p className="result-highlight result-highlight--weak">
          Weakest link: {result.weakestPlayer.name} ({result.weakestPlayer.position}) — OVR{' '}
          {result.weakestPlayer.overall}
        </p>
      )}
      <RatingBreakdown result={result} />
      <div className="final-lineup">
        <h3>Your lineup</h3>
        <ul className="final-lineup-list">
          {LINEUP_POSITIONS.map((pos) => {
            const player = lineup[pos]
            return (
              <li key={pos}>
                <span className="final-pos">{pos}</span>
                <span className="final-name">{player?.name ?? '—'}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="result-actions">
        <button type="button" className="btn btn-secondary" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy result'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          Draft again
        </button>
      </div>
    </section>
  )
}
