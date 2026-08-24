import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import SeriesBroadcast from '@/components/SeriesBroadcast'
import BoxScoreCard from '@/components/BoxScoreCard'
import GameBoxScoreModal from '@/components/GameBoxScoreModal'
import ShareResultPanel from '@/components/ShareResultPanel'
import StandingsTable from '@/components/StandingsTable'
import PlayoffBracket from '@/components/PlayoffBracket'
import {
  buildTeamNameById,
  buildUserGameOpponents,
  playoffOpponentId,
  playoffSeriesToSimulated,
  postseasonLabel,
  sideLabels,
  singleGameToSeries,
  userGameOutcome,
  userGameScore,
} from '@/lib/sim162-display'
import { buildSim162SharePath, type Sim162ShareInput } from '@/lib/sim162-share-url'
import { BRAND } from '@/lib/brand'
import type { SimulatedSeries } from '@shared/live/live-types'
import type { Sim162SeasonResult } from '@shared/live/sim162-season'

type Sim162ResultScreenProps = {
  result: Sim162SeasonResult
  opponentName?: string
  onRestart: () => void
  readOnly?: boolean
  submitSlot?: ReactNode
  shareInput?: Sim162ShareInput
}

const USER_TEAM_LABEL = 'You'


export default function Sim162ResultScreen({
  result,
  onRestart,
  readOnly = false,
  submitSlot,
  shareInput,
}: Sim162ResultScreenProps) {
  const {
    userRecord,
    postseasonResult,
    wonWorldSeries,
    userQualified,
    marqueeGames,
    userGames,
    playoffBracket,
    userPlayoffSeries,
    seasonSeed,
  } = result

  const label = postseasonLabel(result)
  const isChamps = wonWorldSeries || postseasonResult === 'ws-champs'

  const teamNameById = useMemo(() => buildTeamNameById(), [])
  const opponents = useMemo(
    () => buildUserGameOpponents(seasonSeed, playoffBracket.userTeamId),
    [seasonSeed, playoffBracket.userTeamId],
  )
  const marqueeIndices = useMemo(
    () => new Set(marqueeGames.map((m) => m.gameIndex)),
    [marqueeGames],
  )

  const [openMarquee, setOpenMarquee] = useState<number | null>(null)
  const [boxScoreGame, setBoxScoreGame] = useState<number | null>(null)
  const [watchPlayoff, setWatchPlayoff] = useState<{
    series: SimulatedSeries
    opponent: string
    userLabel?: string
  } | null>(null)

  const sharePath = shareInput ? buildSim162SharePath(shareInput) : null
  const shareUrl =
    sharePath && typeof window !== 'undefined'
      ? `${window.location.origin}${sharePath}`
      : sharePath
  const shareTitle = `${BRAND.name}: Sim 162 ${userRecord.wins}-${userRecord.losses} · ${label}`
  const shareText = shareUrl ? `${shareTitle}\n${shareUrl}` : shareTitle

  const postseasonLines = useMemo(() => {
    if (!userQualified) return []
    const lines: Array<{
      round: string
      text: string
      won: boolean
      series: SimulatedSeries
      opponent: string
    }> = []
    let ui = 0
    for (const round of playoffBracket.rounds) {
      const us = round.series.find((s) => s.isUserSeries)
      if (!us) continue
      const series =
        userPlayoffSeries[ui] ??
        playoffSeriesToSimulated(us, playoffBracket.userTeamId)
      ui += 1
      const opponentId = playoffOpponentId(us, playoffBracket.userTeamId)
      const opponent = teamNameById.get(opponentId) ?? opponentId
      const won = us.winnerTeamId === playoffBracket.userTeamId
      lines.push({
        round: round.name,
        text: `${won ? 'Won' : 'Lost'} ${series.userWins}-${series.opponentWins} vs ${opponent}`,
        won,
        series,
        opponent,
      })
    }
    return lines
  }, [
    userQualified,
    playoffBracket,
    userPlayoffSeries,
    teamNameById,
  ])

  const playoffSeeds = useMemo(() => {
    const seeds = new Map<string, number>()
    for (const field of result.playoffField) {
      for (const s of field.seeds) seeds.set(s.teamId, s.seed)
    }
    return seeds
  }, [result.playoffField])

  const boxScoreTarget =
    boxScoreGame !== null ? userGames[boxScoreGame] : undefined
  const boxScoreEntry =
    boxScoreGame !== null && boxScoreTarget
      ? {
          outcome: userGameOutcome(boxScoreTarget, boxScoreGame, seasonSeed),
          ...userGameScore(boxScoreTarget),
        }
      : null

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <Card
        className={cn(
          'mx-auto text-center',
          isChamps && 'border-primary/60 ring-2 ring-primary/40',
        )}
        aria-labelledby="sim162-result-heading"
      >
        <CardHeader className="items-center text-center">
          <CardTitle
            id="sim162-result-heading"
            className="font-display text-xl text-primary"
          >
            {readOnly ? 'Shared season result' : 'Season complete'}
          </CardTitle>
          <p
            className="font-display text-5xl font-bold tabular-nums"
            aria-live="polite"
          >
            {userRecord.wins}-{userRecord.losses}
          </p>
          <p
            className={cn(
              'text-base font-medium',
              isChamps ? 'text-primary' : 'text-foreground',
            )}
          >
            {label}
          </p>
          {userQualified && userRecord.wins + userRecord.losses > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.userPlayoffSeed != null
                ? `Playoff seed #${result.userPlayoffSeed} · ${playoffBracket.userLeague}`
                : playoffBracket.userLeague}
            </p>
          )}
        </CardHeader>
      </Card>

      {isChamps && (
        <Card className="border-primary/60 bg-primary/5">
          <CardContent className="space-y-1 pt-4 text-center">
            <p className="font-display text-2xl font-bold text-primary">
              World Series Champions!
            </p>
            <p className="text-sm text-muted-foreground">
              Your roster took the title in {userRecord.wins}-
              {userRecord.losses} and ran the postseason table.
            </p>
          </CardContent>
        </Card>
      )}

      {marqueeGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">
              Marquee games
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              The moments that shaped the season. Tap to watch.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {marqueeGames.map((m) => {
              const opponent = opponents[m.gameIndex] ?? 'Opponent'
              const isOpen = openMarquee === m.gameIndex
              const { user: you, opponent: them } = userGameScore(m.game)
              const outcome = userGameOutcome(m.game, m.gameIndex, seasonSeed)
              return (
                <div
                  key={m.gameIndex}
                  className="rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">
                        {m.label}{' '}
                        <span
                          className={cn(
                            'tabular-nums',
                            outcome === 'W' ? 'text-primary' : 'text-destructive',
                          )}
                        >
                          {outcome} {you}–{them}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Game {m.gameIndex + 1} · vs {opponent}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOpenMarquee(isOpen ? null : m.gameIndex)
                      }
                    >
                      {isOpen ? 'Hide highlights' : 'Watch highlights'}
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-border/60 p-3">
                      <SeriesBroadcast
                        series={singleGameToSeries(m.game, opponent)}
                        opponentName={opponent}
                        userTeamLabel={USER_TEAM_LABEL}
                        readOnly={readOnly}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            162-game box scores
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Every simulated game, start to finish. Marquee games are marked ★.
          </p>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-card/20 p-2">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
              {userGames.map((game, i) => (
                <BoxScoreCard
                  key={i}
                  game={game}
                  gameIndex={i}
                  isMarquee={marqueeIndices.has(i)}
                  opponentName={opponents[i]}
                  outcome={userGameOutcome(game, i, seasonSeed)}
                  onClick={() => setBoxScoreGame(i)}
                />
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-[0.65rem] text-muted-foreground">
            Tap any game for its full box score.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            Final standings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Full league results from your simulated season. Numbers mark
            playoff seeds.
          </p>
        </CardHeader>
        <CardContent>
          <StandingsTable
            standings={result.standings}
            userLeague={playoffBracket.userLeague}
            userTeamId={playoffBracket.userTeamId}
            playoffSeeds={playoffSeeds}
            teamNameById={teamNameById}
          />
        </CardContent>
      </Card>

      {userQualified ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">
              Postseason
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {watchPlayoff && (
              <div className="rounded-lg border border-primary/40 bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">
                    {watchPlayoff.userLabel
                      ? `${watchPlayoff.userLabel} vs ${watchPlayoff.opponent} — series broadcast`
                      : `${watchPlayoff.opponent} — series broadcast`}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWatchPlayoff(null)}
                  >
                    Hide
                  </Button>
                </div>
                <SeriesBroadcast
                  series={watchPlayoff.series}
                  opponentName={watchPlayoff.opponent}
                  userTeamLabel={watchPlayoff.userLabel ?? USER_TEAM_LABEL}
                  readOnly={readOnly}
                />
              </div>
            )}

            {postseasonLines.length > 0 && (
              <div className="space-y-1.5">
                {postseasonLines.map((line) => (
                  <button
                    key={line.round}
                    type="button"
                    onClick={
                      () =>
                        setWatchPlayoff({
                          series: line.series,
                          opponent: line.opponent,
                        })
                    }
                    className="flex w-full items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                    aria-label={`${line.round}: ${line.text} — watch series`}
                  >
                    <span className="font-medium text-foreground">
                      {line.round}
                    </span>
                    <span
                      className={cn(
                        line.won ? 'text-primary' : 'text-destructive',
                      )}
                    >
                      {line.text}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Separator />

            <PlayoffBracket
              bracket={playoffBracket}
              userTeamId={playoffBracket.userTeamId}
              teamNameById={teamNameById}
              onWatchSeries={(series, opponentName, userLabel) =>
                setWatchPlayoff({
                  series,
                  opponent: opponentName,
                  userLabel,
                })
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-destructive/40">
          <CardContent className="space-y-1 pt-4 text-center">
            <p className="font-display text-lg font-semibold text-destructive">
              Eliminated — missed the playoffs.
            </p>
            <p className="text-sm text-muted-foreground">
              Draft better next time.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mx-auto">
        <CardContent className="space-y-4 pt-6">
          <ShareResultPanel
            shareUrl={shareUrl}
            shareTitle={shareTitle}
            shareText={shareText}
            trackProps={{ record: `${userRecord.wins}-${userRecord.losses}` }}
            restartLabel={readOnly ? 'Play your own' : 'Play again'}
            onRestart={onRestart}
            showLeaderboard
          >
            {!readOnly && submitSlot}
          </ShareResultPanel>
        </CardContent>
      </Card>

      <GameBoxScoreModal
        title={
          boxScoreEntry
            ? `Game ${boxScoreGame! + 1} · ${boxScoreEntry.outcome} ${boxScoreEntry.user}-${boxScoreEntry.opponent} vs ${opponents[boxScoreGame!] ?? 'opponent'}`
            : ''
        }
        entries={
          boxScoreEntry && boxScoreGame !== null
            ? [
                {
                  label: 'Box score',
                  game: userGames[boxScoreGame]!,
                  ...sideLabels(
                    userGames[boxScoreGame]!,
                    'You',
                    opponents[boxScoreGame] ?? 'Opponent',
                  ),
                },
              ]
            : []
        }
        onClose={() => setBoxScoreGame(null)}
      />
    </div>
  )
}
