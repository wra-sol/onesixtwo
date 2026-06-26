import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import SpinReels from '@/components/SpinReels'
import LiveDraftShell from '@/components/LiveDraftShell'
import LiveLineupGrid from '@/components/LiveLineupGrid'
import { buildLiveDraftConfig } from '@/lib/live-draft-mode-config'
import {
  canReroll,
  isUserTurn,
  LIVE_DRAFT_TOTAL_ROUNDS,
} from '@shared/live/live-draft'
import { useMemo, useState } from 'react'

import type { LivePlayer } from '@shared/live/live-types'

export default function LiveDraftRoute() {
  const [aiReveal, setAiReveal] = useState<LivePlayer | null>(null)

  const config = useMemo(() => buildLiveDraftConfig(setAiReveal), [])

  return (
    <LiveDraftShell
      config={config}
      title="Live Draft"
      subtitle={({ draftState }) => {
        if (draftState?.mode !== 'live-draft') return ''
        if (draftState.status === 'stuck') {
          return 'No team left with legal picks for both sides — fill scarce slots earlier next time.'
        }
        if (draftState.roundStatus === 'spinning') {
          return `Round ${draftState.round} · Spinning team…`
        }
        const team = draftState.currentTeam?.teamAbbrev ?? '—'
        const turn = isUserTurn(draftState) ? 'Your pick' : 'AI picking…'
        return `Round ${draftState.round}/${LIVE_DRAFT_TOTAL_ROUNDS} · ${team} · Pick ${draftState.currentPick}/24 · ${turn}`
      }}
      extraPlayerPanel={({
        draftState,
        playersById,
        handleUserReroll,
        canSelect,
      }) =>
        draftState?.mode === 'live-draft' && draftState.status === 'drafting' ? (
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm text-primary">
                  Round {draftState.round} of {LIVE_DRAFT_TOTAL_ROUNDS}
                </p>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {draftState.round}/{LIVE_DRAFT_TOTAL_ROUNDS}
                </span>
              </div>
              <Progress
                value={Math.round((draftState.round / LIVE_DRAFT_TOTAL_ROUNDS) * 100)}
                max={100}
                aria-hidden
              />
              <div
                className={
                  draftState.roundStatus === 'spinning'
                    ? 'spin-card spin-card--active'
                    : 'spin-card'
                }
              >
                <SpinReels
                  teamName={draftState.currentTeam?.teamName ?? 'Spinning…'}
                  era="2020s"
                  isSpinning={draftState.roundStatus === 'spinning'}
                  spinIntent="round"
                  teamPreview={draftState.currentTeam?.teamName ?? '…'}
                  eraPreview="2020s"
                  hideEra
                />
              </div>
              {canSelect && handleUserReroll && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!canReroll('user', draftState)}
                  onClick={handleUserReroll}
                >
                  {draftState.userRerollUsed
                    ? 'Re-spin team used'
                    : 'Re-spin team · 1×'}
                </Button>
              )}
            </div>

            {aiReveal && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                AI drafted {aiReveal.name} ({aiReveal.teamAbbrev})
              </div>
            )}

            {draftState.picks.length > 0 && (
              <div className="rounded-lg border border-border p-2 text-xs">
                <p className="mb-1 font-semibold text-primary">Draft log</p>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                  {[...draftState.picks].reverse().slice(0, 8).map((pick) => {
                    const player = playersById.get(pick.playerId)
                    return (
                      <li key={pick.pickNumber}>
                        R{pick.round} · #{pick.pickNumber}{' '}
                        {pick.side === 'user' ? 'You' : 'AI'}:{' '}
                        {player?.name ?? pick.playerId} ({player?.teamAbbrev ?? '—'})
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : null
      }
      lineupPanel={({
        draftState,
        selectedPlayer,
        isAssigning,
        isLineupPhase,
        canSelect,
        handleAssign,
      }) =>
        draftState?.mode === 'live-draft' ? (
          <div className="space-y-3">
            <div>
              <p className="mb-2 font-display text-sm text-primary">Your lineup</p>
              <LiveLineupGrid
                lineup={draftState.userLineup}
                selectedPlayer={selectedPlayer}
                isAssigning={isAssigning && !isLineupPhase && canSelect}
                onAssign={handleAssign}
              />
            </div>
            <div>
              <p className="mb-2 font-display text-sm text-muted-foreground">AI lineup</p>
              <LiveLineupGrid
                lineup={draftState.aiLineup}
                selectedPlayer={null}
                isAssigning={false}
                onAssign={() => undefined}
              />
            </div>
          </div>
        ) : null
      }
      alternateLink={{ href: '/daily-matchup', label: 'Daily Matchup' }}
    />
  )
}
