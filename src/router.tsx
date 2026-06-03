import { createBrowserRouter } from 'react-router-dom'
import Root from './root'
import { DataPage, PrivacyPage, TermsPage } from './routes/legal-page'
import HomeRoute from './routes/home'
import ShareRoute from './routes/share'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'share', element: <ShareRoute /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'data', element: <DataPage /> },
    ],
  },
])
