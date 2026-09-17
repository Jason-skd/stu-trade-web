import { QueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { components } from '../../api/generated/schema.ts'
import { AppProviders } from '../../app/providers.tsx'
import { appRoutes } from '../../app/routes.tsx'
import { server } from '../../mocks/server.ts'

function renderRoute(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

describe('marketplace', () => {
  it('normalizes unsupported URL filters', async () => {
    const router = renderRoute('/?type=unknown&condition=broken&unused=value')

    expect(await screen.findByRole('link', { name: '高等数学（第七版）' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('restores filters from the URL and switches listing kind', async () => {
    const user = userEvent.setup()
    const router = renderRoute('/?q=计算机&condition=like_new')

    expect(await screen.findByRole('link', { name: '计算机网络' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '成色' })).toHaveValue('like_new')

    await user.click(screen.getByRole('button', { name: '求购需求' }))
    expect(await screen.findByRole('heading', { name: '没有找到挂单' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?type=buy&q=%E8%AE%A1%E7%AE%97%E6%9C%BA&condition=like_new')
  })

  it('submits search filters and can recover from a failed request', async () => {
    let requests = 0
    server.use(
      http.get('*/api/v1/sell-listings', () => {
        requests += 1
        return requests === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ items: [], nextCursor: null })
      }),
    )
    const user = userEvent.setup()
    const router = renderRoute()

    expect(await screen.findByRole('heading', { name: '市集暂时无法载入' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重新加载' }))
    expect(await screen.findByRole('heading', { name: '没有找到挂单' })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('输入 ISBN 或书名'), ' 高等数学 ')
    await user.click(screen.getByRole('button', { name: '搜索' }))
    expect(router.state.location.search).toBe('?q=%E9%AB%98%E7%AD%89%E6%95%B0%E5%AD%A6')
  })

  it('loads another cursor page', async () => {
    server.use(
      http.get('*/api/v1/sell-listings', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        const item = {
          id: cursor ? 'sell-next' : 'sell-first',
          owner: { id: 'other', nickname: '陈同学' },
          book: { isbn: cursor ? '9787302517597' : '9787040396638', title: cursor ? '数据结构' : '高等数学', author: '教材编写组' },
          condition: 'good',
          price: { amount: 3000, currency: 'CNY' },
          status: 'open',
          availableActions: ['purchase'],
          createdAt: '2026-09-16T08:00:00+08:00',
          updatedAt: '2026-09-16T08:00:00+08:00',
        } satisfies components['schemas']['SellListing']
        return HttpResponse.json({ items: [item], nextCursor: cursor ? null : 'next' })
      }),
    )
    const user = userEvent.setup()
    renderRoute()

    expect(await screen.findByRole('link', { name: '高等数学' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看更多' }))
    expect(await screen.findByRole('link', { name: '数据结构' })).toBeInTheDocument()
  })

  it.each([
    ['/sell-listings/sell-1', '挂单仍然有效'],
    ['/sell-listings/sell-3', '此挂单已失效'],
  ])('shows detail state at %s', async (path, state) => {
    renderRoute(path)
    expect(await screen.findByText(state)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回市集' })).toHaveAttribute('href', '/')
  })

  it('identifies the current user own listing', async () => {
    server.use(
      http.get('*/api/v1/sessions/current', () =>
        HttpResponse.json({ user: { id: 'user-1', nickname: '林同学', email: 'lin@example.edu' } }),
      ),
    )
    renderRoute('/sell-listings/sell-2')
    expect(await screen.findByText('这是你的挂单')).toBeInTheDocument()
  })

  it('preserves marketplace filters through detail navigation', async () => {
    const user = userEvent.setup()
    const router = renderRoute('/?type=buy&condition=fair')

    await user.click(await screen.findByRole('link', { name: '深入理解计算机系统' }))
    expect(router.state.location.pathname).toBe('/buy-requests/buy-1')
    expect(router.state.location.search).toBe('?type=buy&condition=fair')
    expect(await screen.findByRole('link', { name: '返回市集' })).toHaveAttribute(
      'href',
      '/?type=buy&condition=fair',
    )
  })
})
