import { useState } from 'react'
import type { SimulatedSeries } from '@shared/live/live-types'
import { coinFlipTieWinner } from '@shared/live/series-sim'
import type {
  HeadlineMoment,
  PerformerStat,
  PitcherStat,
} from '@/lib/series-replay'
import { buildGameBoxScore } from '@/lib/box-score'
import { sideLabels, userGameScore } from '@/lib/sim162-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import GameBoxScoreCard from '@/components/GameBoxScoreCard'
import { cn } from '@/lib/utils'

type SeriesRecapProps = {
  series: SimulatedSeries
  opponentName: string
  userTeamLabel: string
  opponentTeamLabel: string
  userStars: PerformerStat[]
  opponentStars: PerformerStat[]
  userPitchers: PitcherStat[]
  opponentPitchers: PitcherStat[]
  headline: HeadlineMoment
  readOnly: boolean
}

function formatStarLine(p: PerformerStat): string {
  const parts: string[] = []
  if (p.homeRuns > 0) parts.push(`${p.homeRuns} HR`)
  if (p.rbi > 0) parts.push(`${p.rbi} RBI`)
  if (p.hits > 0) parts.push(`${p.hits} H`)
  if (parts.length === 0) parts.push('0 H')
  return `${p.name} — ${parts.join(', ')}`
}

function formatPitcherLine(p: PitcherStat): string {
  const parts = [`${p.ip} IP`, `${p.strikeouts} K`]
  if (p.runs > 0) parts.push(`${p.runs} R`)
  return `${p.name} — ${parts.join(', ')}`
}

export function SeriesRecap({
  series,
  opponentName,
  userTeamLabel,
  opponentTeamLabel,
  userStars,
  opponentStars,
  userPitchers,
  opponentPitchers,
  headline,
  readOnly,
}: SeriesRecapProps) {
  const [openGame, setOpenGame] = useState<number | null>(null)

  // Coin-flip tie policy (Sim 162) credits tied games via a seeded flip while
  // the stored score stays level; mirror that here so rows match the tally.
  const tiesCredited =
    series.userWins + series.opponentWins === series.games.length

  const title = readOnly
    ? 'Shared series result'
    : series.wonSeries
      ? 'Series win'
      : 'Series loss'
  const titleColor = readOnly
    ? 'text-primary'
    : series.wonSeries
      ? 'text-primary'
      : 'text-destructive'

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="items-center text-center">
        <CardTitle className={cn('font-display text-xl', titleColor)}>
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {userTeamLabel} {series.userWins}-{series.opponentWins} vs {opponentName}{' '}
          · Runs {series.userRuns}-{series.opponentRuns}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <figure className="border-l-4 border-primary pl-3">
          <figcaption className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Headline moment
          </figcaption>
          <blockquote className="mt-1 italic text-foreground">
            {headline.description}
          </blockquote>
        </figure>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Games</h3>
          <div className="space-y-1" aria-label="Game-by-game results">
            {series.games.map((game, i) => {
              const { user: you, opponent: them } = userGameScore(game)
              let letter: 'W' | 'L' | 'T'
              if (you > them) letter = 'W'
              else if (them > you) letter = 'L'
              else if (tiesCredited) {
                letter = coinFlipTieWinner(series.seed, i) ? 'W' : 'L'
              } else {
                letter = 'T'
              }
              const isOpen = openGame === i
              return (
                <div
                  key={i}
                  className="rounded-md border border-border bg-card/40"
                >
                  <button
                    type="button"
                    onClick={() => setOpenGame(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-label={`Game ${i + 1}: ${letter} ${you}-${them} — view box score`}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/40"
                  >
                    <span className="font-medium text-muted-foreground">
                      Game {i + 1}
                    </span>
                    <span
                      className={cn(
                        'tabular-nums font-semibold',
                        letter === 'T'
                          ? 'text-muted-foreground'
                          : letter === 'W'
                            ? 'text-primary'
                            : 'text-destructive',
                      )}
                    >
                      {letter} {you}-{them}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/60 p-2">
                      <GameBoxScoreCard
                        box={buildGameBoxScore(game)}
                        {...sideLabels(
                          game,
                          userTeamLabel,
                          opponentTeamLabel,
                        )}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            Tap a game for its full box score.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">Your stars</h3>
          {userStars.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No standout performances.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {userStars.map((p) => (
                <li key={p.name}>{formatStarLine(p)}</li>
              ))}
            </ul>
          )}
          {userPitchers.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {userPitchers.map((p) => (
                <li key={p.name}>{formatPitcherLine(p)}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {opponentTeamLabel} stars
          </h3>
          {opponentStars.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No standout performances.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {opponentStars.map((p) => (
                <li key={p.name}>{formatStarLine(p)}</li>
              ))}
            </ul>
          )}
          {opponentPitchers.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {opponentPitchers.map((p) => (
                <li key={p.name}>{formatPitcherLine(p)}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
