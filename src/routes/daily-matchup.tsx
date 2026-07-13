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
      }) => {
        if (!draftState || !snapshot || draftState.mode !== 'daily-matchup' || !dailyMatchupSnapshot) {
          return null
        }
        if (isLineupPhase) return null
        return (
          <DailyDraftProgress
            lineup={draftState.lineup}
            players={snapshot.players}
            draftedPlayerIds={draftState.draftedPlayerIds}
            draftedTeamIds={draftState.draftedTeamIds}
            opponentTeamId={draftState.opponent.teamId}
            fallbackWarning={fallbackWarning}
          />
        )
      }}
      playerBrowser={({
        filteredPlayers,
        search,
        setSearch,
        selectedPlayer,
        canSelect,
        getDisabledReason,
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
