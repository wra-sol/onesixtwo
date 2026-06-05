import { createBrowserRouter } from 'react-router-dom'
import Root from './root'
import { DataPage, PrivacyPage, TermsPage } from './routes/legal-page'
import ActiveRoute from './routes/active'
import ActiveLeaderboardRoute from './routes/active-leaderboard'
import HomeRoute from './routes/home'
import LeaderboardRoute from './routes/leaderboard'
import ShareRoute from './routes/share'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'active', element: <ActiveRoute /> },
      { path: 'active/leaderboard', element: <ActiveLeaderboardRoute /> },
      { path: 'leaderboard', element: <LeaderboardRoute /> },
      { path: 'share', element: <ShareRoute /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'data', element: <DataPage /> },
    ],
  },
])
