import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import GameTurnStrip from '@/components/GameTurnStrip'
import { GameMark } from '@/components/GameArt'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import LivePlayerCard from '@/components/LivePlayerCard'
import TeamFilter from '@/components/TeamFilter'
import Roster25Grid, { RotationOrderEditor } from '@/components/Roster25Grid'
import { BattingOrderEditor } from '@/components/LiveLineupGrid'
import Sim162ResultScreen from '@/components/Sim162ResultScreen'
import Sim162LeaderboardSubmit from '@/components/Sim162LeaderboardSubmit'
import { useSim162Session } from '@/hooks/useSim162Session'
import { useScrollToBrowserOnDeselect } from '@/hooks/useScrollToBrowserOnDeselect'
import { trackEvent } from '@/lib/analytics'
import type { Sim162ShareInput } from '@/lib/sim162-share-url'
import type { Sim162Pool } from '@/lib/sim162-snapshot'
import { challengeDate } from '@shared/live/live-dates'
import { roster25Players, roster25ToPlayerIds } from '@shared/live/roster25'

const POOL_OPTIONS: Array<{ id: Sim162Pool; label: string; description: string }> = [
  {
    id: 'live',
    label: 'Current MLB',
    description: 'Use the active MLB rosters in today\u2019s snapshot.',
  },
  {
    id: 'legends',
    label: 'All-Time Legends',
    description: 'Draft from the legends pool and run an all-time season.',
  },
]

export default function Sim162Route() {
  const [searchParams] = useSearchParams()
  const poolParam = searchParams.get('pool')
  const initialPool: Sim162Pool | undefined =
    poolParam === 'live' || poolParam === 'legends' ? poolParam : undefined

  const session = useSim162Session(initialPool)
  const {
    pool,
    setPool,
    snapshot,
    draftState,
    isLoading,
    error,
    selectedPlayer,
    search,
    setSearch,
    teamFilter,
    setTeamFilter,
    teamOptions,
    filteredPlayers,
    canSelect,
    isLineupPhase,
    battingOrder,
    setBattingOrder,
    rotationOrder,
    setRotationOrder,
    handleSelect,
    handleAssign,
    handleAutoFill,
    handleSimulate,
    isSimulating,
    seasonResult,
    getDisabledReason,
    retry,
  } = session

  useScrollToBrowserOnDeselect(selectedPlayer?.id ?? null)

  useEffect(() => {
    if (!seasonResult || !pool) return
    trackEvent('sim162_season_simulated', {
      pool,
      wins: seasonResult.userRecord.wins,
      losses: seasonResult.userRecord.losses,
      postseasonResult: seasonResult.postseasonResult,
    })
    if (seasonResult.userQualified) {
      trackEvent('sim162_playoff_qualified', {
        pool,
        seed: seasonResult.userPlayoffSeed ?? 0,
      })
    }
    if (seasonResult.wonWorldSeries) {
      trackEvent('sim162_won_world_series', { pool })
    }
  }, [seasonResult, pool])

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

  if (!pool) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <h2 className="text-center font-display text-xl text-primary">
          Choose your Sim 162 pool
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {POOL_OPTIONS.map((option) => (
            <Card key={option.id} className="border-primary/40">
              <CardHeader>
                <CardTitle className="font-display text-lg text-primary">
                  {option.label}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setPool(option.id)}
                >
                  Draft from {option.label}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="underline">
            Back to mode select
          </Link>
        </p>
      </div>
    )
  }

  if (isLoading || !snapshot || !draftState) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 py-4" aria-busy="true">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <GameMark kind="loading" className="game-loading-mark size-10 text-primary" />
          <div className="h-8 flex-1 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
        </div>
        <p className="sr-only">
          Loading Sim 162 ({pool === 'live' ? 'Current MLB' : 'All-Time Legends'})
        </p>
      </div>
    )
  }

  if (seasonResult) {
    const playerIds = roster25ToPlayerIds(draftState.roster)
    const battingOrderIds = battingOrder.map((p) => p.id)
    const rotationOrderIds = rotationOrder.map((p) => p.id)
    const currentChallengeDate = challengeDate()
    const shareInput: Sim162ShareInput = {
      pool,
      challengeDate: currentChallengeDate,
      playerIds,
      battingOrderIds,
      rotationOrderIds,
      simSeed: snapshot?.simSeed ?? '',
    }
    return (
      <Sim162ResultScreen
        result={seasonResult}
        onRestart={() => window.location.reload()}
        submitSlot={
          <Sim162LeaderboardSubmit
            pool={pool}
            challengeDate={currentChallengeDate}
            playerIds={playerIds}
            battingOrderIds={battingOrderIds}
            rotationOrderIds={rotationOrderIds}
            simSeed={snapshot?.simSeed ?? ''}
            wins={seasonResult.userRecord.wins}
            losses={seasonResult.userRecord.losses}
            postseasonResult={seasonResult.postseasonResult}
            wonWorldSeries={seasonResult.wonWorldSeries}
            userQualified={seasonResult.userQualified}
          />
        }
        shareInput={shareInput}
      />
    )
  }

  if (draftState.status === 'stuck') {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-destructive" role="alert">
          Draft stuck: no legal player remains for every open slot. Use Auto-fill or start over.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Start over
        </Button>
      </div>
    )
  }

  const isAssigning = selectedPlayer !== null && !isLineupPhase && canSelect
  const filledCount = roster25Players(draftState.roster).length
  const sim162TurnStrip = (() => {
    if (isLineupPhase) {
      return {
        label: 'Roster complete',
        title: 'Set the order and rotation',
        detail: 'Choose the nine hitters and five starters, then simulate the season.',
        tone: 'setup' as const,
      }
    }
    if (selectedPlayer) {
      return {
        label: 'Player selected',
        title: `Assign ${selectedPlayer.name}`,
        detail: 'Choose a highlighted open slot in the 25-man roster.',
        tone: 'active' as const,
      }
    }
    return {
      label: 'Your move',
      title: 'Draft the next player',
      detail: 'Build the roster one legal pick at a time, or use Auto-fill to finish the open slots.',
      tone: 'active' as const,
    }
  })()

  return (
    <div className="space-y-3">
      <GameTurnStrip
        {...sim162TurnStrip}
        progress={{
          value: (filledCount / 25) * 100,
          label: `${filledCount}/25`,
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">
              Sim 162 —{' '}
              {pool === 'live' ? 'Current MLB' : 'All-Time Legends'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isLineupPhase
                ? 'Set your batting order and rotation, then simulate the season.'
                : `Draft your 25-man roster — ${filledCount}/25 filled.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isLineupPhase ? (
              <>
                <TeamFilter
                  options={teamOptions}
                  value={teamFilter}
                  onChange={setTeamFilter}
                  disabled={!canSelect || search.trim().length > 0}
                  hint={search.trim() ? 'Searching all teams' : undefined}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search all players by name"
                      disabled={!canSelect}
                      aria-label="Search all players by name"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handleAutoFill}
                    disabled={!canSelect}
                    title="Fill every remaining legal slot with an eligible player"
                  >
                    Auto-fill open slots
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-fill only uses legal players and one player per team.
                </p>
                <div
                  className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border"
                  data-player-browser="true"
                >
                  {filteredPlayers.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                      <GameMark
                        kind="empty"
                        className="size-10 text-muted-foreground"
                      />
                      <p className="text-sm text-muted-foreground">
                        No players match these filters.
                      </p>
                    </div>
                  )}
                  {filteredPlayers.map((player) => (
                    <LivePlayerCard
                      key={player.id}
                      player={player}
                      selected={selectedPlayer?.id === player.id}
                      disabled={
                        !canSelect || Boolean(getDisabledReason(player))
                      }
                      disabledReason={
                        !canSelect ? undefined : getDisabledReason(player)
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
                  onChange={setBattingOrder}
                />
                <RotationOrderEditor
                  order={rotationOrder}
                  onChange={setRotationOrder}
                />
                <Button
                  type="button"
                  onClick={handleSimulate}
                  disabled={isSimulating}
                >
                  {isSimulating ? 'Simulating…' : 'Simulate Season'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Roster25Grid
          roster={draftState.roster}
          selectedPlayer={selectedPlayer}
          isAssigning={isAssigning}
          onAssign={handleAssign}
        />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/" className="underline">
          Back to mode select
        </Link>
      </p>
    </div>
  )
}
