import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import LiveLineupGrid, { BattingOrderEditor } from '@/components/LiveLineupGrid'
import LivePlayerCard from '@/components/LivePlayerCard'
import LiveResultScreen from '@/components/LiveResultScreen'
import LiveLeaderboardSubmit from '@/components/LiveLeaderboardSubmit'
import { lineupPlayerIdsFromDailyLineup } from '@shared/live/live-lineup-ids'
import type { LiveShareInput } from '@shared/live/live-types'
import {
  useLiveDraftSession,
  type LiveModeConfig,
} from '@/hooks/useLiveDraftSession'
import { useScrollToBrowserOnDeselect } from '@/hooks/useScrollToBrowserOnDeselect'
import GameTurnStrip from '@/components/GameTurnStrip'
import { GameMark } from '@/components/GameArt'
import { DAILY_LINEUP_POSITIONS, dailyLineupPlayers } from '@shared/live/daily-roster'
import { LIVE_DRAFT_TOTAL_ROUNDS } from '@shared/live/live-draft'

type LiveDraftSession = ReturnType<typeof useLiveDraftSession>

type LiveDraftShellProps = {
  config: LiveModeConfig
  title: string
  subtitle: (session: LiveDraftSession) => string
  unavailable?: (session: LiveDraftSession) => React.ReactNode
  extraPlayerPanel?: (session: LiveDraftSession) => React.ReactNode
  lineupPanel?: (session: LiveDraftSession) => React.ReactNode
  loadingState?: (session: LiveDraftSession) => React.ReactNode
  errorState?: (session: LiveDraftSession) => React.ReactNode
  playerBrowser?: (session: LiveDraftSession) => React.ReactNode
  lineupPhase?: (session: LiveDraftSession) => React.ReactNode
  alternateLink?: { href: string; label: string }
}

export default function LiveDraftShell({
  config,
  title,
  subtitle,
  unavailable,
  extraPlayerPanel,
  lineupPanel,
  loadingState,
  errorState,
  playerBrowser,
  lineupPhase,
  alternateLink,
}: LiveDraftShellProps) {
  const session = useLiveDraftSession(config)
  const {
    snapshot,
    dailyMatchupSnapshot,
    draftState,
    selectedPlayer,
    search,
    setSearch,
    series,
    error,
    isFallback,
    isLoading,
    filteredPlayers,
    playerListMessage,
    canSelect,
    isLineupPhase,
    isAssigning,
    userLineup,
    userBattingOrderIds,
    aiLineup,
    handleSelect,
    handleAssign,
    handleSimulate,
    handleBattingOrderChange,
    isStuck,
    retry,
    opponentName,
    getDisabledReason,
    getPlayerBadge,
  } = session

  const filledSlots = draftState
    ? dailyLineupPlayers(
        draftState.mode === 'live-draft'
          ? draftState.userLineup
          : draftState.lineup,
      ).length
    : 0

  const turnStrip = (() => {
    if (!draftState) return null
    if (isLineupPhase) {
      return {
        label: 'Lineup complete',
        title: 'Set the batting order',
        detail: 'Put the nine hitters in the order you want, then simulate the series.',
        tone: 'setup' as const,
      }
    }
    if (selectedPlayer) {
      return {
        label: 'Player selected',
        title: `Assign ${selectedPlayer.name}`,
        detail: 'Choose an open position in your lineup. The highlighted slots are legal for this player.',
        tone: 'active' as const,
      }
    }
    if (!canSelect) {
      return {
        label:
          draftState.mode === 'live-draft' && draftState.roundStatus === 'spinning'
            ? `Round ${draftState.round} of ${LIVE_DRAFT_TOTAL_ROUNDS}`
            : 'Draft in progress',
        title: 'AI is picking',
        detail: 'The next legal player will appear here when the AI finishes its turn.',
        tone: 'waiting' as const,
      }
    }
    return {
      label: 'Your move',
      title: 'Choose a player',
      detail: 'Start with the strongest legal player for the open positions.',
      tone: 'active' as const,
    }
  })()

  useScrollToBrowserOnDeselect(selectedPlayer?.id ?? null)

  if (error) {
    return (
      errorState?.(session) ?? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-destructive" role="alert">
            {error}
          </p>
          <Button type="button" variant="outline" onClick={() => void retry()}>
            Retry
          </Button>
        </div>
      )
    )
  }

  if (isLoading || !snapshot || !draftState || !userLineup) {
    return (
      loadingState?.(session) ?? (
        <p className="py-8 text-center text-muted-foreground">
          Loading {title}…
        </p>
      )
    )
  }

  if (isStuck) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-destructive" role="alert">
          Draft stuck: no team has enough legal players for both sides. Start over and fill C and CL earlier.
        </p>
        <Button type="button" variant="outline" onClick={() => void retry()}>
          Start over
        </Button>
      </div>
    )
  }

  if (dailyMatchupSnapshot && !dailyMatchupSnapshot.available) {
    return (
      unavailable?.(session) ?? (
        <Card className="mx-auto max-w-xl">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl text-primary">
              {title} unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm">
            <p>{dailyMatchupSnapshot.unavailableReason ?? 'Unavailable today.'}</p>
            <Link
              to="/live-draft"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Play Live Draft
            </Link>
          </CardContent>
        </Card>
      )
    )
  }

  if (series) {
    const shareInput: LiveShareInput | undefined =
      userLineup && snapshot
        ? {
            mode: config.mode,
            challengeDate: snapshot.challengeDate,
            targetDate:
              snapshot.kind === 'daily-matchup' ? snapshot.targetDate : undefined,
            playerIds: lineupPlayerIdsFromDailyLineup(userLineup),
            battingOrderIds: userBattingOrderIds,
            aiPlayerIds: aiLineup
              ? lineupPlayerIdsFromDailyLineup(aiLineup)
              : undefined,
            simSeed: snapshot.simSeed,
          }
        : undefined

    return (
      <LiveResultScreen
          series={series}
          opponentName={opponentName}
          shareInput={shareInput}
          onRestart={() => window.location.reload()}
          submitSlot={
            <LiveLeaderboardSubmit
              mode={config.mode}
              challengeDate={snapshot.challengeDate}
              targetDate={
                snapshot.kind === 'daily-matchup' ? snapshot.targetDate : undefined
              }
              userLineup={userLineup}
              userBattingOrderIds={userBattingOrderIds}
              aiLineup={aiLineup}
              simSeed={snapshot.simSeed}
              disabled={isFallback}
              disabledReason={
                isFallback
                  ? 'Sample data is active. Leaderboard submission is off.'
                  : undefined
              }
            />
          }
        />
    )
  }

  const battingOrder =
    draftState.mode === 'live-draft'
      ? draftState.userBattingOrder
      : draftState.battingOrder

  const lineupGrid =
    draftState.mode === 'live-draft' ? draftState.userLineup : draftState.lineup

  return (
    <div className="space-y-3">
      {turnStrip && (
        <GameTurnStrip
          {...turnStrip}
          progress={{
            value: (filledSlots / DAILY_LINEUP_POSITIONS.length) * 100,
            label: `${filledSlots}/${DAILY_LINEUP_POSITIONS.length}`,
          }}
        />
      )}
      <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <Card className="game-draft-board">
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{subtitle(session)}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {extraPlayerPanel?.(session)}

            {!isLineupPhase ? (
              playerBrowser?.(session) ?? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-sm text-primary">
                      Choose a player
                    </h3>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {filteredPlayers.length} shown
                    </span>
                  </div>
                  <label htmlFor="live-player-search" className="sr-only">
                    Search players
                  </label>
                  <Input
                    id="live-player-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name"
                    disabled={!canSelect}
                  />
                  <div
                    className="max-h-[30rem] divide-y divide-border overflow-y-auto rounded-lg border border-border"
                    data-player-browser="true"
                  >
                    {filteredPlayers.length === 0 && (
                      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                        <GameMark
                          kind="empty"
                          className="size-10 text-muted-foreground"
                        />
                        <p className="text-sm text-muted-foreground">
                          {playerListMessage ?? 'No players match this search.'}
                        </p>
                      </div>
                    )}
                    {filteredPlayers.map((player) => (
                      <LivePlayerCard
                        key={player.id}
                        player={player}
                        badge={getPlayerBadge(player)}
                        selected={selectedPlayer?.id === player.id}
                        disabled={!canSelect || Boolean(getDisabledReason(player))}
                        disabledReason={
                          !canSelect ? 'Wait for your turn' : getDisabledReason(player)
                        }
                        onSelect={() => handleSelect(player)}
                        compact
                      />
                    ))}
                  </div>
                </>
              )
            ) : (
              lineupPhase?.(session) ?? (
                <>
                  <BattingOrderEditor
                    order={battingOrder}
                    onChange={handleBattingOrderChange}
                  />
                  <Button type="button" onClick={handleSimulate}>
                    Simulate best-of-3
                  </Button>
                </>
              )
            )}
          </CardContent>
        </Card>

        {lineupPanel?.(session) ?? (
          <LiveLineupGrid
            lineup={lineupGrid}
            selectedPlayer={selectedPlayer}
            isAssigning={isAssigning && !isLineupPhase && canSelect}
            onAssign={handleAssign}
          />
        )}
      </div>

      {alternateLink && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to={alternateLink.href} className="underline">
            {alternateLink.label}
          </Link>
        </p>
      )}
    </div>
  )
}

export type { LiveModeConfig }
