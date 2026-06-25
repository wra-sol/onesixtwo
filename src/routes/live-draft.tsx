import { useState } from 'react'
import LiveDraftShell from '@/components/LiveDraftShell'
import LiveLineupGrid from '@/components/LiveLineupGrid'
import { buildLiveDraftConfig } from '@/lib/live-draft-mode-config'
import { isUserTurn } from '@shared/live/live-draft'

import type { LivePlayer } from '@shared/live/live-types'

export default function LiveDraftRoute() {
  const [aiReveal, setAiReveal] = useState<LivePlayer | null>(null)

  return (
    <LiveDraftShell
      config={buildLiveDraftConfig(setAiReveal)}
      title="Live Draft"
      subtitle={({ draftState }) =>
        draftState?.mode === 'live-draft'
          ? `Pick ${draftState.currentPick}/24 · ${isUserTurn(draftState) ? 'Your pick' : 'AI picking…'}`
          : ''
      }
      extraPlayerPanel={({ draftState, playersById }) =>
        draftState?.mode === 'live-draft' ? (
          <>
            {aiReveal && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                AI selects {aiReveal.name} ({aiReveal.teamAbbrev})
              </div>
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
          </>
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
            <LiveLineupGrid
              lineup={draftState.userLineup}
              selectedPlayer={selectedPlayer}
              isAssigning={isAssigning && !isLineupPhase && canSelect}
              onAssign={handleAssign}
            />
            <LiveLineupGrid
              lineup={draftState.aiLineup}
              selectedPlayer={null}
              isAssigning={false}
              onAssign={() => undefined}
            />
          </div>
        ) : null
      }
      alternateLink={{ href: '/daily-matchup', label: 'Daily Matchup' }}
    />
  )
}
