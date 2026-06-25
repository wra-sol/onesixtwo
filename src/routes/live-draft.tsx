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
import type { DailyLineupPosition } from '@/lib/daily-roster'
import {
  advanceLiveDraftAfterPick,
  createLiveDraftState,
  draftLiveUserPlayer,
  getLiveDraftUserDisabledReason,
  isUserTurn,
  setLiveDraftBattingOrder,
  snakeDraftSide,
} from '@/lib/live-draft'
import {
  fetchLiveDraftSnapshot,
  lineupPlayerIdsFromDailyLineup,
  submitLiveLeaderboard,
} from '@/lib/live-api-client'
import { buildSimTeam, simulateBestOfThree } from '@/lib/pa-sim'
import type { LiveDraftSnapshot, LivePlayer, SimulatedSeries } from '@/lib/live-types'
import { normalizeForSearch } from '@/lib/text'
import { readStoredInitials, writeStoredInitials } from '@/lib/leaderboard'

const AI_REVEAL_MS = 600

export default function LiveDraftRoute() {
  const [snapshot, setSnapshot] = useState<LiveDraftSnapshot | null>(null)
  const [draftState, setDraftState] = useState<ReturnType<
    typeof createLiveDraftState
  > | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [aiReveal, setAiReveal] = useState<LivePlayer | null>(null)
  const [series, setSeries] = useState<SimulatedSeries | null>(null)
  const [initials, setInitials] = useState(() => readStoredInitials())
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetchLiveDraftSnapshot()
      .then((data) => {
        setSnapshot(data)
        let state = createLiveDraftState(data)
        if (!data.coinFlipUserFirst) {
          state = advanceLiveDraftAfterPick(state, data.players, data.simSeed)
        }
        setDraftState(state)
      })
      .catch(() => {
        setSnapshot(null)
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

  const runAiTurns = useCallback(
    (state: NonNullable<typeof draftState>) => {
      if (!snapshot) return state
      const before = state.picks.length
      const next = advanceLiveDraftAfterPick(state, snapshot.players, snapshot.simSeed)
      const newPick = next.picks[next.picks.length - 1]
      if (newPick && newPick.side === 'ai' && next.picks.length > before) {
        const player = playersById.get(newPick.playerId)
        if (player) {
          setAiReveal(player)
          window.setTimeout(() => setAiReveal(null), AI_REVEAL_MS)
        }
      }
      return next
    },
    [snapshot, playersById],
  )

  const handleSelect = useCallback(
    (player: LivePlayer) => {
      if (!draftState || !snapshot || !isUserTurn(draftState)) return
      if (getLiveDraftUserDisabledReason(player, draftState)) return
      setSelectedPlayerId(player.id)
    },
    [draftState, snapshot],
  )

  const handleAssign = useCallback(
    (position: DailyLineupPosition) => {
      if (!draftState || !snapshot || !selectedPlayer) return
      let next = draftLiveUserPlayer(
        draftState,
        selectedPlayer,
        snapshot.players,
        snapshot.simSeed,
        position,
      )
      if (next.currentPick <= 24 && snakeDraftSide(next.currentPick, next.userPicksFirst) === 'ai') {
        next = runAiTurns(next)
      }
      setDraftState(next)
      setSelectedPlayerId(null)
    },
    [draftState, snapshot, selectedPlayer, runAiTurns],
  )

  const handleSimulate = useCallback(() => {
    if (!draftState || !snapshot) return
    const confirmed = setLiveDraftBattingOrder(
      draftState,
      draftState.userBattingOrder,
    )
    setDraftState(confirmed)

    const userTeam = buildSimTeam(
      'You',
      confirmed.userLineup,
      confirmed.userBattingOrder,
      true,
    )
    const opponentTeam = buildSimTeam(
      'AI',
      confirmed.aiLineup,
      confirmed.aiBattingOrder,
      false,
    )
    setSeries(simulateBestOfThree(userTeam, opponentTeam, snapshot.simSeed))
  }, [draftState, snapshot])

  const handleSubmit = async () => {
    if (!draftState || !snapshot || !series) return
    const response = await submitLiveLeaderboard({
      mode: 'live-draft',
      challengeDate: snapshot.challengeDate,
      initials,
      playerIds: lineupPlayerIdsFromDailyLineup(draftState.userLineup),
      battingOrderIds: draftState.userBattingOrder.map((p) => p.id),
      aiPlayerIds: lineupPlayerIdsFromDailyLineup(draftState.aiLineup),
      simSeed: snapshot.simSeed,
    })
    if (response.ok) {
      writeStoredInitials(initials)
      setSubmitMessage(`Submitted — #${response.rank} on today's board.`)
    } else {
      setSubmitMessage(response.error)
    }
  }

  if (!snapshot || !draftState) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Loading Live Draft…
      </p>
    )
  }

  if (series) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LiveResultScreen
          series={series}
          opponentName="AI"
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

  const isAssigning = selectedPlayer !== null
  const isLineupPhase = draftState.status === 'lineup'
  const userTurn = isUserTurn(draftState)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg text-primary">
              Live Draft
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick {draftState.currentPick}/24 ·{' '}
              {userTurn ? 'Your pick' : 'AI picking…'}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiReveal && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                AI selects {aiReveal.name} ({aiReveal.teamAbbrev})
              </div>
            )}

            {!isLineupPhase ? (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players"
                  disabled={!userTurn}
                />
                <div className="divide-y divide-border rounded-lg border border-border">
                  {filteredPlayers.map((player) => (
                    <LivePlayerCard
                      key={player.id}
                      player={player}
                      selected={selectedPlayerId === player.id}
                      disabled={
                        !userTurn ||
                        Boolean(getLiveDraftUserDisabledReason(player, draftState))
                      }
                      disabledReason={
                        !userTurn
                          ? 'Wait for your pick'
                          : getLiveDraftUserDisabledReason(player, draftState)
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
                  order={draftState.userBattingOrder}
                  onChange={(order) =>
                    setDraftState({ ...draftState, userBattingOrder: order })
                  }
                />
                <Button type="button" onClick={handleSimulate}>
                  Simulate best-of-3
                </Button>
              </>
            )}

            {draftState.picks.length > 0 && (
              <div className="rounded-lg border border-border p-2 text-xs">
                <p className="mb-1 font-semibold text-primary">Draft log</p>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                  {[...draftState.picks].reverse().slice(0, 8).map((pick) => (
                    <li key={pick.pickNumber}>
                      #{pick.pickNumber}{' '}
                      {pick.side === 'user' ? 'You' : 'AI'}:{' '}
                      {playersById.get(pick.playerId)?.name ?? pick.playerId}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <LiveLineupGrid
            lineup={draftState.userLineup}
            selectedPlayer={selectedPlayer}
            isAssigning={isAssigning && !isLineupPhase && userTurn}
            onAssign={handleAssign}
          />
          <LiveLineupGrid
            lineup={draftState.aiLineup}
            selectedPlayer={null}
            isAssigning={false}
            onAssign={() => undefined}
          />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/daily-matchup" className="underline">
          Daily Matchup
        </Link>
      </p>
    </div>
  )
}
