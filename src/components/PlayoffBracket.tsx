import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { playoffSeriesToSimulated } from '@/lib/sim162-display'
import type { SimulatedSeries } from '@shared/live/live-types'
import type { PlayoffBracket as PlayoffBracketData } from '@shared/live/sim162-season'

type PlayoffBracketProps = {
  bracket: PlayoffBracketData
  userTeamId: string
  teamNameById: Map<string, string>
  onWatchSeries?: (series: SimulatedSeries, opponentName: string) => void
}

function teamLabel(
  teamId: string,
  seed: number,
  teamNameById: Map<string, string>,
): string {
  const name = teamNameById.get(teamId) ?? teamId
  return `${seed} ${name}`
}

export default function PlayoffBracket({
  bracket,
  userTeamId,
  teamNameById,
  onWatchSeries,
}: PlayoffBracketProps) {
  const rounds = bracket.rounds

  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-4"
      aria-label="Playoff bracket"
    >
      {rounds.map((round) => (
        <div key={round.name} className="space-y-2">
          <h4 className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
            {round.name}
          </h4>
          <div className="space-y-2">
            {round.series.map((ps, seriesIndex) => {
              const isUser = ps.isUserSeries
              const awayWon = ps.winnerTeamId === ps.awayTeamId
              const homeWon = ps.winnerTeamId === ps.homeTeamId
              const hasGames = Boolean(ps.games?.length)
              const opponentId =
                isUser && hasGames
                  ? ps.awayTeamId === userTeamId
                    ? ps.homeTeamId
                    : ps.awayTeamId
                  : null
              return (
                <div
                  key={`${round.name}-${seriesIndex}`}
                  className={cn(
                    'rounded-md border p-2 text-xs',
                    isUser
                      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border bg-card/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate',
                        awayWon && 'font-semibold text-foreground',
                        !awayWon && 'text-muted-foreground',
                      )}
                    >
                      {teamLabel(ps.awayTeamId, ps.awaySeed, teamNameById)}
                    </span>
                    <span className="tabular-nums font-medium">
                      {ps.awayWins}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate',
                        homeWon && 'font-semibold text-foreground',
                        !homeWon && 'text-muted-foreground',
                      )}
                    >
                      {teamLabel(ps.homeTeamId, ps.homeSeed, teamNameById)}
                    </span>
                    <span className="tabular-nums font-medium">
                      {ps.homeWins}
                    </span>
                  </div>
                  {isUser && hasGames && opponentId && onWatchSeries && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        const series = playoffSeriesToSimulated(ps, userTeamId)
                        const opponentName =
                          teamNameById.get(opponentId) ?? opponentId
                        onWatchSeries(series, opponentName)
                      }}
                    >
                      Watch
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
