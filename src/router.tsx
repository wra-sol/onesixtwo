import { createBrowserRouter } from 'react-router-dom'
import Root from './root'
import { DataPage, PrivacyPage, TermsPage } from './routes/legal-page'
import HomeRoute from './routes/home'
import DailyMatchupRoute from './routes/daily-matchup'
import LiveDraftRoute from './routes/live-draft'
import Sim162Route from './routes/sim162'
import LeaderboardRoute from './routes/leaderboard'
import ShareRoute from './routes/share'
import LiveShareRoute from './routes/live-share'
import Sim162ShareRoute from './routes/sim162-share'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'daily-matchup', element: <DailyMatchupRoute /> },
      { path: 'live-draft', element: <LiveDraftRoute /> },
      { path: 'sim162', element: <Sim162Route /> },
      { path: 'leaderboard', element: <LeaderboardRoute /> },
      { path: 'share', element: <ShareRoute /> },
      { path: 'live-share', element: <LiveShareRoute /> },
      { path: 'sim162-share', element: <Sim162ShareRoute /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'data', element: <DataPage /> },
    ],
  },
])
