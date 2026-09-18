import { QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { components } from '../api/generated/schema.ts'
import { server } from '../mocks/server.ts'
import { AppProviders } from './providers.tsx'
import { appRoutes } from './routes.tsx'

// === render application route ===

function renderRoute(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })

  return render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

// === verify application shell ===

describe('application shell', () => {
  it('navigates between the stable primary routes', async () => {
    const user = userEvent.setup()
    renderRoute()

    expect(
      screen.getByRole('heading', { level: 1, name: '市集' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '登录' })).toHaveAttribute(
      'href',
      '/login',
    )

    const navigation = screen.getByRole('navigation', { name: '主导航' })
    expect(within(navigation).getByRole('link', { name: '我的发布' })).toHaveAttribute(
      'href',
      '/my-listings',
    )
    const ordersLink = within(navigation).getByRole('link', { name: '订单' })
    await user.click(ordersLink)

    expect(
      await screen.findByRole('heading', { level: 1, name: '登录' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '注册' })).toHaveAttribute(
      'href',
      '/signup?returnTo=%2Forders',
    )
  })

  it('exposes authentication routes and a not-found route', () => {
    const { unmount } = renderRoute('/signup')

    expect(
      screen.getByRole('heading', { level: 1, name: '注册' }),
    ).toBeInTheDocument()

    unmount()
    renderRoute('/missing')

    expect(
      screen.getByRole('heading', { level: 1, name: '页面不存在' }),
    ).toBeInTheDocument()
  })

  it('shows the restored user from the current session contract', async () => {
    const session = {
      user: {
        id: 'user-1',
        nickname: '林同学',
        email: 'lin@example.edu',
      },
    } satisfies components['schemas']['Session']

    server.use(
      http.get('*/api/v1/sessions/current', () => HttpResponse.json(session)),
    )
    renderRoute('/me')

    expect(await screen.findByRole('link', { name: '林同学' })).toHaveAttribute(
      'href',
      '/me',
    )
    expect(screen.getByText('林同学', { selector: 'p' })).toBeInTheDocument()
  })
})
