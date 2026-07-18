import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import LiveDraftShell from '@/components/LiveDraftShell'
import DailyDraftProgress from '@/components/daily-matchup/DailyDraftProgress'
import DailyErrorState from '@/components/daily-matchup/DailyErrorState'
import DailyLineupGrid from '@/components/daily-matchup/DailyLineupGrid'
import DailyLineupPhase from '@/components/daily-matchup/DailyLineupPhase'
import DailyLoadingState from '@/components/daily-matchup/DailyLoadingState'
import DailyOpponentPreview from '@/components/daily-matchup/DailyOpponentPreview'
import DailyPlayerBrowser from '@/components/daily-matchup/DailyPlayerBrowser'
import DailyUnavailableState from '@/components/daily-matchup/DailyUnavailableState'
import { dailyMatchupConfig } from '@/lib/daily-matchup-mode-config'
import { formatDailyMatchupSubtitle } from '@shared/live/daily-matchup-display'
import { dailyMatchupStarBudget } from '@shared/live/daily-star-budget'

export default function DailyMatchupRoute() {
  return (
    <LiveDraftShell
      config={dailyMatchupConfig}
      title="Daily Matchup"
      subtitle={({ dailyMatchupSnapshot }) =>
        dailyMatchupSnapshot ? formatDailyMatchupSubtitle(dailyMatchupSnapshot) : ''
      }
      loadingState={() => <DailyLoadingState />}
      errorState={({ error, retry }) => (
        <DailyErrorState message={error ?? 'Load failed'} onRetry={retry} />
      )}
      unavailable={({ dailyMatchupSnapshot }) =>
        dailyMatchupSnapshot ? (
          <DailyUnavailableState
            reason={dailyMatchupSnapshot.unavailableReason}
            challengeDate={dailyMatchupSnapshot.challengeDate}
            targetDate={dailyMatchupSnapshot.targetDate}
          />
        ) : null
      }
      extraPlayerPanel={({
        draftState,
        snapshot,
        isLineupPhase,
        fallbackWarning,
        dailyMatchupSnapshot,
        handleToggleSalaryCap,
      }) => {
        if (!draftState || !snapshot || draftState.mode !== 'daily-matchup' || !dailyMatchupSnapshot) {
          return null
        }
        if (isLineupPhase) return null
        const stars = dailyMatchupStarBudget(draftState)
        const locked = draftState.draftedPlayerIds.length > 0
        return (
          <div className="space-y-3">
            <label className="flex items-start gap-2 rounded-lg border border-border p-3">
              <Checkbox
                className="mt-0.5"
                checked={draftState.salaryCapEnabled}
                onCheckedChange={(checked) => handleToggleSalaryCap(checked === true)}
                disabled={locked}
              />
              <span className="text-sm">
                <span className="font-display text-primary">Salary Cap mode</span>
                <span className="block text-[0.65rem] text-muted-foreground">
                  Optional challenge: draft within a star budget instead of picking every
                  stud. {locked ? 'Locked in for this draft.' : 'Turn on before your first pick.'}
                </span>
              </span>
            </label>

            {draftState.salaryCapEnabled && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm text-primary">Star budget</p>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {stars.spent}/{stars.budget}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, Math.round((stars.spent / stars.budget) * 100))}
                  max={100}
                  aria-hidden
                />
                <p className="text-[0.65rem] text-muted-foreground">
                  Elite 4 · Plus-Plus 3 · Plus 2 · else 1 star. Spend wisely — you can't
                  afford every star.
                </p>
                {stars.remaining <= 0 && (
                  <p className="text-[0.65rem] text-destructive">
                    Budget spent — only 1-star players left.
                  </p>
                )}
              </div>
            )}

            <DailyDraftProgress
              lineup={draftState.lineup}
              players={snapshot.players}
              draftedPlayerIds={draftState.draftedPlayerIds}
              draftedTeamIds={draftState.draftedTeamIds}
              opponentTeamId={draftState.opponent.teamId}
              fallbackWarning={fallbackWarning}
            />
          </div>
        )
      }}
      playerBrowser={({
        filteredPlayers,
        search,
        setSearch,
        selectedPlayer,
        canSelect,
        getDisabledReason,
        getPlayerBadge,
        handleSelect,
        isLineupPhase,
      }) =>
        isLineupPhase ? null : (
          <DailyPlayerBrowser
            players={filteredPlayers}
            search={search}
            setSearch={setSearch}
            selectedPlayer={selectedPlayer}
            canSelect={canSelect}
            getDisabledReason={getDisabledReason}
            getPlayerBadge={getPlayerBadge}
            onSelect={handleSelect}
          />
        )
      }
      lineupPanel={({
        draftState,
        dailyMatchupSnapshot,
        selectedPlayer,
        isAssigning,
        isLineupPhase,
        canSelect,
        handleAssign,
      }) => {
        if (!draftState || draftState.mode !== 'daily-matchup' || !dailyMatchupSnapshot) {
          return null
        }
        return (
          <div className="space-y-3">
            {dailyMatchupSnapshot.opponent && (
              <DailyOpponentPreview
                opponent={dailyMatchupSnapshot.opponent}
                opponentGameScore={dailyMatchupSnapshot.opponentGameScore}
              />
            )}
            <DailyLineupGrid
              lineup={draftState.lineup}
              selectedPlayer={selectedPlayer}
              isAssigning={isAssigning && !isLineupPhase && canSelect}
              onAssign={handleAssign}
            />
          </div>
        )
      }}
      lineupPhase={({ draftState, dailyMatchupSnapshot, handleBattingOrderChange, handleSimulate }) => {
        if (!draftState || draftState.mode !== 'daily-matchup' || !dailyMatchupSnapshot) {
          return null
        }
        if (!dailyMatchupSnapshot.opponent) return null
        return (
          <DailyLineupPhase
            battingOrder={draftState.battingOrder}
            onChange={handleBattingOrderChange}
            onSimulate={handleSimulate}
            opponent={dailyMatchupSnapshot.opponent}
          />
        )
      }}
      alternateLink={{ href: '/live-draft', label: 'Live Draft' }}
    />
  )
}
