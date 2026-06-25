import LiveDraftShell from '@/components/LiveDraftShell'
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
    />
  )
}
