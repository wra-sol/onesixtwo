import LiveDraftShell from '@/components/LiveDraftShell'
import { dailyMatchupConfig } from '@/lib/daily-matchup-mode-config'

export default function DailyMatchupRoute() {
  return (
    <LiveDraftShell
      config={dailyMatchupConfig}
      title="Daily Matchup"
      subtitle={({ dailyMatchupSnapshot }) =>
        dailyMatchupSnapshot
          ? `Target ${dailyMatchupSnapshot.targetDate} · Opponent ${dailyMatchupSnapshot.opponent?.teamName ?? '—'} (${dailyMatchupSnapshot.opponentGameScore.runs} runs)`
          : ''
      }
    />
  )
}
