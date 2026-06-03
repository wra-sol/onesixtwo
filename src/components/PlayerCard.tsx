import type { HitterStats, PitcherStats, Player } from '../lib/types'

type PlayerCardProps = {
  player: Player
  selected: boolean
  disabled: boolean
  disabledReason?: string | null
  compact?: boolean
  onSelect: () => void
}

function formatStats(player: Player): string {
  if (player.role === 'pitcher') {
    const s = player.stats as PitcherStats
    return `ERA ${s.era} · WHIP ${s.whip} · ${s.so} K · ${s.wins} W`
  }
  const s = player.stats as HitterStats
  return `AVG ${s.avg} · ${s.hr} HR · ${s.rbi} RBI · OPS ${s.ops}`
}

export default function PlayerCard({
  player,
  selected,
  disabled,
  disabledReason,
  compact = false,
  onSelect,
}: PlayerCardProps) {
  if (compact) {
    return (
      <button
        type="button"
        className={`player-card player-card--compact ${selected ? 'player-card--selected' : ''}`}
        disabled={disabled}
        aria-pressed={selected}
        title={disabledReason ?? undefined}
        onClick={onSelect}
      >
        <span className="player-card-name">{player.name}</span>
        <span className="player-card-positions">
          {player.positions.join(' · ')}
        </span>
        <span className="player-card-stats">{formatStats(player)}</span>
        <span className="player-card-rating">OVR {player.ratings.overall}</span>
        {disabled && disabledReason && (
          <span className="player-card-disabled-reason">{disabledReason}</span>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`player-card ${selected ? 'player-card--selected' : ''}`}
      disabled={disabled}
      aria-pressed={selected}
      title={disabledReason ?? undefined}
      onClick={onSelect}
    >
      <span className="player-card-name">{player.name}</span>
      <span className="player-card-meta">
        {player.teamName} · {player.era}
      </span>
      <span className="player-card-stats">{formatStats(player)}</span>
      <span className="player-card-positions">
        {player.positions.join(' · ')}
      </span>
      <span className="player-card-rating">OVR {player.ratings.overall}</span>
      {disabled && disabledReason && (
        <span className="player-card-disabled-reason">{disabledReason}</span>
      )}
    </button>
  )
}
