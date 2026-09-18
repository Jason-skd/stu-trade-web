import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { components } from '../../api/generated/schema.ts'
import { confirmOrderCompletion } from '../../api/orders.ts'
import { login } from '../../api/session.ts'
import { AppProviders } from '../../app/providers.tsx'
import { appRoutes } from '../../app/routes.tsx'
import { server } from '../../mocks/server.ts'

// === define order fixtures ===

const seller = { id: 'user-2', nickname: '陈同学', email: 'chen@example.edu' }
const buyer = { id: 'user-1', nickname: '林同学', email: 'lin@example.edu' }

function order(id: string, title: string, status: components['schemas']['OrderStatus'] = 'pending_delivery') {
  return {
    id,
    matchId: `match-${id}`,
    book: { isbn: '9787040396638', title, author: '教材编写组' },
    seller,
    buyer,
    agreedPrice: { amount: 3250, currency: 'CNY' },
    status,
    sellerConfirmedCompletionAt: status === 'completed' ? '2026-09-18T01:00:00Z' : null,
    buyerConfirmedCompletionAt: status === 'completed' ? '2026-09-18T01:01:00Z' : null,
    createdAt: '2026-09-18T00:00:00Z',
    updatedAt: '2026-09-18T01:01:00Z',
  } satisfies components['schemas']['Order']
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

async function authenticate(email = 'lin@example.edu') {
  await login({ email, password: 'secret123' })
}

function renderRoute(path = '/orders') {
  window.localStorage.setItem('stutrade.locale', 'zh-CN')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<AppProviders queryClient={queryClient}><RouterProvider router={router} /></AppProviders>)
  return router
}

// === verify order ledger behavior ===

describe('orders', () => {
  it('defaults to pending delivery and shows both roles, contacts, and progress', async () => {
    await authenticate()
    renderRoute()

    expect(await screen.findByText('高等数学（第七版）')).toBeInTheDocument()
    expect(screen.getByText('深入理解计算机系统')).toBeInTheDocument()
    expect(screen.getByText('买方')).toBeInTheDocument()
    expect(screen.getByText('卖方')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'chen@example.edu' })).toHaveAttribute(
      'href', 'mailto:chen@example.edu',
    )
    expect(screen.getByText('等待对方确认')).toBeInTheDocument()
    expect(screen.getAllByLabelText('交付确认进度')).toHaveLength(2)
  })

  it('switches status through the URL and shows completed orders', async () => {
    await authenticate()
    const user = userEvent.setup()
    const router = renderRoute('/orders?status=unsupported')

    await screen.findByText('高等数学（第七版）')
    await user.click(screen.getByRole('button', { name: '已完成' }))
    expect(router.state.location.search).toBe('?status=completed')
    expect(await screen.findByText('数据结构')).toBeInTheDocument()
    expect(screen.getByText('双方已确认交付')).toBeInTheDocument()
  })

  it('loads another cursor page', async () => {
    await authenticate()
    server.use(http.get('*/api/v1/orders', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor')
      return HttpResponse.json({
        items: [order(cursor ? 'order-2' : 'order-1', cursor ? '第二本书' : '第一本书')],
        nextCursor: cursor ? null : 'next',
      })
    }))
    const user = userEvent.setup()
    renderRoute()

    expect(await screen.findByText('第一本书')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '加载更多订单' }))
    expect(await screen.findByText('第二本书')).toBeInTheDocument()
  })

  it('shows an empty state and recovers from a failed list request', async () => {
    await authenticate()
    let requests = 0
    server.use(http.get('*/api/v1/orders', () => {
      requests += 1
      return requests === 1
        ? HttpResponse.json(problem(500, 'internal_error'), { status: 500 })
        : HttpResponse.json({ items: [], nextCursor: null })
    }))
    const user = userEvent.setup()
    renderRoute()

    expect(await screen.findByRole('alert')).toHaveTextContent('订单暂时无法载入')
    await user.click(screen.getByRole('button', { name: '重新加载' }))
    expect(await screen.findByText('还没有待交付订单。')).toBeInTheDocument()
    expect(screen.getByText('从市集完成交易后，订单会出现在这里。')).toBeInTheDocument()
  })

  it('requires a second confirmation then waits for the counterparty', async () => {
    await authenticate()
    const user = userEvent.setup()
    renderRoute()

    await user.click(await screen.findByRole('button', { name: '确认已完成交付' }))
    const confirmation = screen.getByText('请在线下完成书籍与款项交接后再确认。确认后需等待对方完成确认。').parentElement!
    await user.click(within(confirmation).getByRole('button', { name: '暂不确认' }))
    expect(screen.getByRole('button', { name: '确认已完成交付' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认已完成交付' }))
    await user.click(screen.getByRole('button', { name: '确认交付完成' }))
    await waitFor(() => expect(screen.getAllByText('等待对方确认')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: '确认已完成交付' })).not.toBeInTheDocument()
  })

  it('moves the order to completed after the final party confirms', async () => {
    await authenticate()
    await confirmOrderCompletion('order-pending-1')
    await authenticate('chen@example.edu')
    const user = userEvent.setup()
    const router = renderRoute()

    await user.click(await screen.findByRole('button', { name: '确认已完成交付' }))
    await user.click(screen.getByRole('button', { name: '确认交付完成' }))
    expect(await screen.findByText('还没有待交付订单。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '已完成' }))
    expect(router.state.location.search).toBe('?status=completed')
    expect(await screen.findByText('高等数学（第七版）')).toBeInTheDocument()
    expect(screen.getByText('双方已确认交付')).toBeInTheDocument()
  })

  it('keeps a conflict notice while refreshing both authoritative lists', async () => {
    await authenticate()
    let completed = false
    server.use(
      http.get('*/api/v1/orders', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status')
        const visible = completed ? status === 'completed' : status === 'pending_delivery'
        return HttpResponse.json({ items: visible ? [order('race-order', '并发成交书', completed ? 'completed' : 'pending_delivery')] : [], nextCursor: null })
      }),
      http.post('*/api/v1/orders/race-order/confirm-completion', () => {
        completed = true
        return HttpResponse.json(problem(409, 'order_not_pending_delivery'), { status: 409 })
      }),
    )
    const user = userEvent.setup()
    renderRoute()

    await user.click(await screen.findByRole('button', { name: '确认已完成交付' }))
    await user.click(screen.getByRole('button', { name: '确认交付完成' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('订单状态已经变化')
    expect(await screen.findByText('还没有待交付订单。')).toBeInTheDocument()
  })
})
