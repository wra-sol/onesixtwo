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
import {
  lineupPlayerIdsFromDailyLineup,
} from '@/lib/live-api-client'
import type { LiveShareInput } from '@shared/live/live-types'
import {
  useLiveDraftSession,
  type LiveModeConfig,
} from '@/hooks/useLiveDraftSession'

type LiveDraftShellProps = {
  config: LiveModeConfig
  title: string
  subtitle: (session: ReturnType<typeof useLiveDraftSession>) => string
  unavailable?: (session: ReturnType<typeof useLiveDraftSession>) => React.ReactNode
  extraPlayerPanel?: (session: ReturnType<typeof useLiveDraftSession>) => React.ReactNode
  lineupPanel?: (session: ReturnType<typeof useLiveDraftSession>) => React.ReactNode
  alternateLink?: { href: string; label: string }
}

export default function LiveDraftShell({
  config,
  title,
  subtitle,
  unavailable,
  extraPlayerPanel,
  lineupPanel,
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
  } = session

  if (error) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-destructive" role="alert">
          {error}
        </p>
        <Button type="button" variant="outline" onClick={() => void retry()}>
          Retry
        </Button>
      </div>
    )
  }

  if (isLoading || !snapshot || !draftState || !userLineup) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Loading {title}…
      </p>
    )
  }

  if (isStuck) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-destructive" role="alert">
          Draft stuck — no legal team or pick remains.
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
      <div className="min-h-0 flex-1 overflow-y-auto">
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
                  ? 'Live data is unavailable — leaderboard submit is disabled.'
                  : undefined
              }
            />
          }
        />
      </div>
    )
  }

  const battingOrder =
    draftState.mode === 'live-draft'
      ? draftState.userBattingOrder
      : draftState.battingOrder

  const lineupGrid =
    draftState.mode === 'live-draft' ? draftState.userLineup : draftState.lineup

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{subtitle(session)}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {extraPlayerPanel?.(session)}

            {!isLineupPhase ? (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players"
                  disabled={!canSelect}
                />
                <div className="divide-y divide-border rounded-lg border border-border">
                  {filteredPlayers.map((player) => (
                    <LivePlayerCard
                      key={player.id}
                      player={player}
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
            ) : (
              <>
                <BattingOrderEditor
                  order={battingOrder}
                  onChange={handleBattingOrderChange}
                />
                <Button type="button" onClick={handleSimulate}>
                  Simulate best-of-3
                </Button>
              </>
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
