import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { LoginPage, SignupPage } from '../features/auth/pages.tsx'
import { ProfilePage } from '../features/auth/ProfilePage.tsx'
import { ProtectedRoute } from '../features/auth/ProtectedRoute.tsx'
import {
  MarketplaceDetailPage,
  MarketplacePage,
  PublishPage,
} from '../features/listings/pages.tsx'
import { MatchesPage } from '../features/matches/pages.tsx'
import { OrdersPage } from '../features/orders/pages.tsx'
import { NotFoundPage } from '../shared/components/Page.tsx'
import { AppShell } from './shell/AppShell.tsx'

// === define application routes ===

/** 声明应用及测试共同使用的浏览器路由。 */
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <MarketplacePage /> },
      {
        path: 'sell-listings/:listingId',
        element: <MarketplaceDetailPage kind="sell" />,
      },
      {
        path: 'buy-requests/:listingId',
        element: <MarketplaceDetailPage kind="buy" />,
      },
      { path: 'publish', element: <ProtectedRoute><PublishPage /></ProtectedRoute> },
      { path: 'matches', element: <ProtectedRoute><MatchesPage /></ProtectedRoute> },
      { path: 'orders', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
      { path: 'me', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

/** 使用正式浏览器历史创建应用路由器。 */
export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
