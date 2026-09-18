import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '../../api/generated/schema.ts'
import { login } from '../../api/session.ts'
import { AppProviders } from '../../app/providers.tsx'
import { appRoutes } from '../../app/routes.tsx'
import { server } from '../../mocks/server.ts'

// === render marketplace route ===

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

async function authenticate() {
  await login({ email: 'lin@example.edu', password: 'secret123' })
}

function problem(status: number, code: components['schemas']['Problem']['code']) {
  return {
    type: `/problems/${code}`,
    title: 'Request failed',
    status,
    code,
    detail: 'Internal detail',
  } satisfies components['schemas']['Problem']
}

// === verify marketplace behavior ===

describe('marketplace', () => {
  it('normalizes unsupported URL filters', async () => {
    const router = renderRoute('/?type=unknown&condition=broken&unused=value')

    expect(
      await screen.findByRole('link', { name: '高等数学（第七版）' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('restores filters from the URL and switches listing kind', async () => {
    const user = userEvent.setup()
    const router = renderRoute('/?q=计算机&condition=like_new')

    expect(await screen.findByRole('link', { name: '计算机网络' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '成色' })).toHaveValue('like_new')

    await user.click(screen.getByRole('button', { name: '求购需求' }))
    expect(await screen.findByRole('heading', { name: '没有找到挂单' })).toBeInTheDocument()
    expect(router.state.location.search).toBe(
      '?type=buy&q=%E8%AE%A1%E7%AE%97%E6%9C%BA&condition=like_new',
    )
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

    expect(
      await screen.findByRole('heading', { name: '市集暂时无法载入' }),
    ).toBeInTheDocument()
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
          book: {
            isbn: cursor ? '9787302517597' : '9787040396638',
            title: cursor ? '数据结构' : '高等数学',
            author: '教材编写组',
          },
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

  it('distinguishes a missing listing from a service failure', async () => {
    renderRoute('/sell-listings/missing')

    expect(
      await screen.findByRole('heading', { name: '挂单不存在' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('挂单可能已删除，或网络暂时不可用。'),
    ).not.toBeInTheDocument()
  })

  it('identifies the current user own listing', async () => {
    server.use(
      http.get('*/api/v1/sessions/current', () =>
        HttpResponse.json({
          user: {
            id: 'user-1',
            nickname: '林同学',
            email: 'lin@example.edu',
          },
        }),
      ),
    )
    renderRoute('/sell-listings/sell-2')
    expect(await screen.findByText('这是你的挂单')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /确认购买/ })).not.toBeInTheDocument()
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

  it('sends an anonymous user to login and returns to the exact detail URL', async () => {
    const user = userEvent.setup()
    const router = renderRoute('/sell-listings/sell-1?q=高数#trade')

    await user.click(await screen.findByRole('button', { name: '登录后确认购买' }))
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toContain(
      encodeURIComponent('/sell-listings/sell-1?q=高数#trade'),
    )
  })

  it('shows the fixed purchase receipt and sends only one request', async () => {
    await authenticate()
    let finish: (() => void) | undefined
    const pending = new Promise<void>((resolve) => { finish = resolve })
    const purchase = vi.fn()
    server.use(http.post('*/api/v1/sell-listings/sell-1/purchase', async () => {
      purchase()
      await pending
      return HttpResponse.json({}, { status: 201 })
    }))
    const user = userEvent.setup()
    const router = renderRoute('/sell-listings/sell-1')

    await user.click(await screen.findByRole('button', { name: '确认购买' }))
    const receipt = screen.getByRole('heading', { name: '成交凭据' }).closest('form')!
    expect(within(receipt).getByText('¥32.50')).toBeInTheDocument()
    expect(screen.getByText('确认后将立即生成订单，不能在此撤销。')).toBeInTheDocument()
    const submission = user.dblClick(screen.getByRole('button', { name: '确认并生成订单' }))
    await waitFor(() => expect(purchase).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: '正在成交…' })).toBeDisabled()
    finish?.()
    await submission
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
  })

  it('submits corrected actual-book data and keeps the seller note independent', async () => {
    await authenticate()
    const accept = vi.fn()
    server.use(http.post('*/api/v1/buy-requests/buy-1/accept', async ({ request }) => {
      accept(await request.json())
      return HttpResponse.json({}, { status: 201 })
    }))
    const user = userEvent.setup()
    const router = renderRoute('/buy-requests/buy-1')

    await user.click(await screen.findByRole('button', { name: '接受求购' }))
    const receipt = screen.getByRole('heading', { name: '成交凭据' }).closest('form')!
    expect(within(receipt).getByLabelText('ISBN')).toHaveValue('9787111544937')
    expect(within(receipt).getByLabelText('书名')).toHaveValue('深入理解计算机系统')
    expect(within(receipt).getByLabelText('作者')).toHaveValue('Randal E. Bryant')
    expect(within(receipt).getByLabelText('卖方备注')).toHaveValue('')
    await user.clear(within(receipt).getByLabelText('书名'))
    await user.type(within(receipt).getByLabelText('书名'), '深入理解计算机系统（实物）')
    await user.selectOptions(within(receipt).getByLabelText('成色'), 'good')
    await user.type(within(receipt).getByLabelText('卖方备注'), '封面有折痕')
    await user.click(screen.getByRole('button', { name: '确认书籍并接单' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
    expect(accept).toHaveBeenCalledWith({
      book: {
        isbn: '9787111544937',
        title: '深入理解计算机系统（实物）',
        author: 'Randal E. Bryant',
      },
      condition: 'good',
      note: '封面有折痕',
    })
  })

  it.each([
    [401, 'unauthenticated', '登录状态已失效'],
    [403, 'forbidden', '没有权限'],
    [404, 'not_found', '挂单不存在'],
    [500, 'internal_error', '成交服务暂时不可用'],
  ] as const)('maps trade failure %s', async (status, code, message) => {
    await authenticate()
    server.use(http.post('*/api/v1/sell-listings/sell-1/purchase', () =>
      HttpResponse.json(problem(status, code), { status })))
    const user = userEvent.setup()
    renderRoute('/sell-listings/sell-1')

    await user.click(await screen.findByRole('button', { name: '确认购买' }))
    await user.click(screen.getByRole('button', { name: '确认并生成订单' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('maps validation failure for actual-book input', async () => {
    await authenticate()
    server.use(http.post('*/api/v1/buy-requests/buy-1/accept', () =>
      HttpResponse.json(problem(400, 'validation_failed'), { status: 400 })))
    const user = userEvent.setup()
    renderRoute('/buy-requests/buy-1')

    await user.click(await screen.findByRole('button', { name: '接受求购' }))
    await user.click(screen.getByRole('button', { name: '确认书籍并接单' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('实际交付书籍信息有误')
  })

  it('refreshes authoritative detail and removes the action after a conflict', async () => {
    await authenticate()
    let conflicted = false
    const listing = {
      id: 'race-1', owner: { id: 'user-2', nickname: '陈同学' },
      book: { isbn: '9787040396638', title: '高等数学', author: '同济大学数学系' },
      condition: 'good', price: { amount: 3250, currency: 'CNY' },
      status: 'open', availableActions: ['purchase'],
      createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z',
    } satisfies components['schemas']['SellListing']
    server.use(
      http.get('*/api/v1/sell-listings/race-1', () => HttpResponse.json({
        ...listing,
        status: conflicted ? 'matched' : 'open',
        availableActions: conflicted ? [] : ['purchase'],
      } satisfies components['schemas']['SellListing'])),
      http.post('*/api/v1/sell-listings/race-1/purchase', () => {
        conflicted = true
        return HttpResponse.json(problem(409, 'listing_unavailable'), { status: 409 })
      }),
    )
    const user = userEvent.setup()
    renderRoute('/sell-listings/race-1')

    await user.click(await screen.findByRole('button', { name: '确认购买' }))
    await user.click(screen.getByRole('button', { name: '确认并生成订单' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('挂单已被处理')
    expect(await screen.findByText('此挂单已失效')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认购买' })).not.toBeInTheDocument()
  })
})
