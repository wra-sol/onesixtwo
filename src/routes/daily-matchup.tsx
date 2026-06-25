import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  createEmptyDailyLineup,
  type DailyLineupPosition,
} from '@/lib/daily-roster'
import {
  createDailyMatchupDraftState,
  draftDailyMatchupPlayer,
  getDailyMatchupDisabledReason,
  heuristicAiBattingOrder,
  setDailyMatchupBattingOrder,
} from '@/lib/live-draft'
import {
  fetchDailyMatchupSnapshot,
  lineupPlayerIdsFromDailyLineup,
  submitLiveLeaderboard,
} from '@/lib/live-api-client'
import { buildSimTeam, simulateBestOfThree } from '@/lib/pa-sim'
import type {
  DailyMatchupSnapshot,
  LivePlayer,
  SimulatedSeries,
} from '@/lib/live-types'
import { normalizeForSearch } from '@/lib/text'
import { readStoredInitials, writeStoredInitials } from '@/lib/leaderboard'

export default function DailyMatchupRoute() {
  const [snapshot, setSnapshot] = useState<DailyMatchupSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftState, setDraftState] = useState<ReturnType<
    typeof createDailyMatchupDraftState
  > | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [series, setSeries] = useState<SimulatedSeries | null>(null)
  const [initials, setInitials] = useState(() => readStoredInitials())
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchDailyMatchupSnapshot()
      .then((data) => {
        setSnapshot(data)
        if (data.available && data.opponent) {
          setDraftState(
            createDailyMatchupDraftState(
              data.challengeDate,
              data.targetDate,
              data.opponent,
            ),
          )
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Load failed')
      })
  }, [])

  const playersById = useMemo(() => {
    const map = new Map<string, LivePlayer>()
    snapshot?.players.forEach((p) => map.set(p.id, p))
    return map
  }, [snapshot])

  const filteredPlayers = useMemo(() => {
    if (!snapshot) return []
    const q = normalizeForSearch(search.trim())
    return snapshot.players
      .filter((p) => !q || normalizeForSearch(p.name).includes(q))
      .sort((a, b) => b.grades.overall - a.grades.overall)
  }, [snapshot, search])

  const selectedPlayer = selectedPlayerId
    ? playersById.get(selectedPlayerId) ?? null
    : null

  const handleSelect = useCallback((player: LivePlayer) => {
    if (!draftState) return
    const reason = getDailyMatchupDisabledReason(player, draftState)
    if (reason) return
    setSelectedPlayerId(player.id)
  }, [draftState])

  const handleAssign = useCallback(
    (position: DailyLineupPosition) => {
      if (!draftState || !selectedPlayer) return
      const next = draftDailyMatchupPlayer(draftState, selectedPlayer, position)
      setDraftState(next)
      setSelectedPlayerId(null)
    },
    [draftState, selectedPlayer],
  )

  const handleConfirmLineup = useCallback(() => {
    if (!draftState || !snapshot?.opponent) return
    const confirmed = setDailyMatchupBattingOrder(
      draftState,
      draftState.battingOrder,
    )
    setDraftState(confirmed)

    const opponentLineup = createEmptyDailyLineup()
    for (const [pos, player] of Object.entries(snapshot.opponent.lineup)) {
      if (player) opponentLineup[pos as DailyLineupPosition] = player
    }
    const opponentOrder =
      snapshot.opponent.battingOrder.length > 0
        ? snapshot.opponent.battingOrder
        : heuristicAiBattingOrder(
            Object.values(snapshot.opponent.lineup).filter(
              (p): p is LivePlayer => Boolean(p),
            ),
          )

    const userTeam = buildSimTeam(
      'You',
      confirmed.lineup,
      confirmed.battingOrder,
      true,
    )
    const opponentTeam = buildSimTeam(
      snapshot.opponent.teamName,
      opponentLineup,
      opponentOrder,
      false,
    )
    setSeries(simulateBestOfThree(userTeam, opponentTeam, snapshot.simSeed))
  }, [draftState, snapshot])

  const handleSubmit = async () => {
    if (!draftState || !snapshot || !series) return
    const response = await submitLiveLeaderboard({
      mode: 'daily-matchup',
      challengeDate: snapshot.challengeDate,
      targetDate: snapshot.targetDate,
      initials,
      playerIds: lineupPlayerIdsFromDailyLineup(draftState.lineup),
      battingOrderIds: draftState.battingOrder.map((p) => p.id),
      simSeed: snapshot.simSeed,
    })
    if (response.ok) {
      writeStoredInitials(initials)
      setSubmitMessage(`Submitted — #${response.rank} on today's board.`)
    } else {
      setSubmitMessage(response.error)
    }
  }

  if (error) {
    return (
      <p className="py-8 text-center text-destructive" role="alert">
        {error}
      </p>
    )
  }

  if (!snapshot) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Loading Daily Matchup…
      </p>
    )
  }

  if (!snapshot.available) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl text-primary">
            Daily Matchup unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm">
          <p>{snapshot.unavailableReason ?? 'No MLB games yesterday.'}</p>
          <Link
            to="/live-draft"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Play Live Draft
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (series && snapshot.opponent) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LiveResultScreen
          series={series}
          opponentName={snapshot.opponent.teamName}
          onRestart={() => window.location.reload()}
          submitSlot={
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Leaderboard</p>
              <div className="flex gap-2">
                <Input
                  value={initials}
                  onChange={(e) =>
                    setInitials(e.target.value.toUpperCase().slice(0, 3))
                  }
                  placeholder="ABC"
                  className="max-w-[6rem] text-center tracking-widest"
                />
                <Button type="button" variant="secondary" onClick={handleSubmit}>
                  Submit
                </Button>
              </div>
              {submitMessage && (
                <p className="text-xs text-muted-foreground">{submitMessage}</p>
              )}
            </div>
          }
        />
      </div>
    )
  }

  if (!draftState) return null

  const isAssigning = selectedPlayer !== null
  const isLineupPhase = draftState.status === 'lineup'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">
              Daily Matchup
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Target {snapshot.targetDate} · Opponent{' '}
              {snapshot.opponent?.teamName} ({snapshot.opponentGameScore.runs}{' '}
              runs)
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isLineupPhase ? (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players"
                />
                <div className="divide-y divide-border rounded-lg border border-border">
                  {filteredPlayers.map((player) => (
                    <LivePlayerCard
                      key={player.id}
                      player={player}
                      selected={selectedPlayerId === player.id}
                      disabled={Boolean(
                        getDailyMatchupDisabledReason(player, draftState),
                      )}
                      disabledReason={getDailyMatchupDisabledReason(
                        player,
                        draftState,
                      )}
                      onSelect={() => handleSelect(player)}
                      compact
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <BattingOrderEditor
                  order={draftState.battingOrder}
                  onChange={(order) =>
                    setDraftState({ ...draftState, battingOrder: order })
                  }
                />
                <Button type="button" onClick={handleConfirmLineup}>
                  Simulate best-of-3
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <LiveLineupGrid
          lineup={draftState.lineup}
          selectedPlayer={selectedPlayer}
          isAssigning={isAssigning && !isLineupPhase}
          onAssign={handleAssign}
        />
      </div>
    </div>
  )
}
