import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
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
import { roster25ToPlayerIds } from '@shared/live/roster25'

const POOL_OPTIONS: Array<{ id: Sim162Pool; label: string; description: string }> = [
  {
    id: 'live',
    label: 'Current MLB',
    description: 'Draft from today\u2019s active MLB players.',
  },
  {
    id: 'legends',
    label: 'All-Time Legends',
    description: 'Draft from the greatest players in history.',
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
          Sim 162 — Choose Your Pool
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
      <p className="py-8 text-center text-muted-foreground">
        Loading Sim 162 ({pool === 'live' ? 'Current MLB' : 'All-Time Legends'})…
      </p>
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
          Draft stuck — not enough unique teams to fill every slot. Try
          auto-fill earlier or start over.
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
  const filledCount = Object.values(draftState.roster).filter(Boolean).length

  return (
    <>
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
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
                <div className="flex items-center gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search all players by name"
                    disabled={!canSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFill}
                    disabled={!canSelect}
                  >
                    Auto-fill
                  </Button>
                </div>
                <div
                  className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border"
                  data-player-browser="true"
                >
                  {filteredPlayers.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      No players match.
                    </p>
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
    </>
  )
}
