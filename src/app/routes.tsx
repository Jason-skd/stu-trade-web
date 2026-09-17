import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { LoginPage, SignupPage } from '../features/auth/pages.tsx'
import {
  MarketplacePage,
  ProfilePage,
  PublishPage,
} from '../features/listings/pages.tsx'
import { MatchesPage } from '../features/matches/pages.tsx'
import { OrdersPage } from '../features/orders/pages.tsx'
import { NotFoundPage } from '../shared/components/Page.tsx'
import { AppShell } from './shell/AppShell.tsx'

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <MarketplacePage /> },
      { path: 'publish', element: <PublishPage /> },
      { path: 'matches', element: <MatchesPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'me', element: <ProfilePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
