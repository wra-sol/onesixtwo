import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Root from './root'
import './index.css'

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const Page = lazy(load)
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: page(() => import('./routes/home')) },
      { path: 'daily-matchup', element: page(() => import('./routes/daily-matchup')) },
      { path: 'live-draft', element: page(() => import('./routes/live-draft')) },
      { path: 'sim162', element: page(() => import('./routes/sim162')) },
      { path: 'leaderboard', element: page(() => import('./routes/leaderboard')) },
      { path: 'share', element: page(() => import('./routes/share')) },
      { path: 'live-share', element: page(() => import('./routes/live-share')) },
      { path: 'sim162-share', element: page(() => import('./routes/sim162-share')) },
      {
        path: 'privacy',
        element: page(() =>
          import('./routes/legal-page').then((m) => ({ default: m.PrivacyPage })),
        ),
      },
      {
        path: 'terms',
        element: page(() =>
          import('./routes/legal-page').then((m) => ({ default: m.TermsPage })),
        ),
      },
      {
        path: 'data',
        element: page(() =>
          import('./routes/legal-page').then((m) => ({ default: m.DataPage })),
        ),
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
