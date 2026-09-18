import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(() => vi.restoreAllMocks())

describe('application shell', () => {
  it('navigates between the stable primary routes', async () => {
    const user = userEvent.setup()
    renderRoute()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Marketplace' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    )

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(within(navigation).getByRole('link', { name: 'Listings' })).toHaveAttribute(
      'href',
      '/my-listings',
    )
    const ordersLink = within(navigation).getByRole('link', { name: 'Orders' })
    await user.click(ordersLink)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Log in' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/signup?returnTo=%2Forders',
    )
  })

  it('exposes authentication routes and a not-found route', () => {
    const { unmount } = renderRoute('/signup')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sign up' }),
    ).toBeInTheDocument()

    unmount()
    renderRoute('/missing')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
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

  it('defaults to English and persists an in-place switch to Simplified Chinese', async () => {
    const user = userEvent.setup()
    const { unmount } = renderRoute('/login')

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))

    fireEvent.submit(screen.getByRole('button', { name: 'Log in' }).closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
    await user.type(screen.getByLabelText('Email'), 'draft@example.edu')
    await user.click(screen.getByRole('button', { name: '中文' }))

    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
    expect(screen.getByLabelText('邮箱')).toHaveValue('draft@example.edu')
    expect(screen.getByRole('alert')).toHaveTextContent('请输入有效的邮箱地址。')
    expect(screen.getByRole('button', { name: '中文' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('zh-CN')
      expect(window.localStorage.getItem('stutrade.locale')).toBe('zh-CN')
    })

    unmount()
    renderRoute('/login')
    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    await waitFor(() => expect(window.localStorage.getItem('stutrade.locale')).toBe('en'))
  })

  it('replaces an unsupported saved locale with the English default', async () => {
    window.localStorage.setItem('stutrade.locale', 'fr')
    renderRoute()

    expect(screen.getByRole('heading', { name: 'Marketplace' })).toBeInTheDocument()
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en')
      expect(window.localStorage.getItem('stutrade.locale')).toBe('en')
    })
  })

  it('falls back to English and keeps switching when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked')
    })
    const user = userEvent.setup()
    renderRoute()

    expect(screen.getByRole('heading', { name: 'Marketplace' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '中文' }))
    expect(screen.getByRole('heading', { name: '市集' })).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.lang).toBe('zh-CN'))
  })
})
