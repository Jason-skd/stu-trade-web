import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '../../api/generated/schema.ts'
import { withdrawSellListing } from '../../api/marketplace.ts'
import { login } from '../../api/session.ts'
import { AppProviders } from '../../app/providers.tsx'
import { appRoutes } from '../../app/routes.tsx'
import { server } from '../../mocks/server.ts'

// === define owned listing fixtures ===

const owner = { id: 'user-1', nickname: '林同学' }
const session = {
  user: { ...owner, email: 'lin@example.edu' },
} satisfies components['schemas']['Session']
type ProblemCode = components['schemas']['Problem']['code']
const problem = (
  status: number,
  code: ProblemCode,
) => ({ type: `/problems/${code}`, title: 'Request failed', status, code, detail: 'Internal detail' }) satisfies components['schemas']['Problem']
const withdrawalFailures: ReadonlyArray<readonly [number, ProblemCode, string]> = [
  [403, 'forbidden', '你不是这条挂单的发布者'],
  [409, 'listing_unavailable', '列表已刷新'],
  [500, 'internal_error', '停用失败'],
]

function authenticate() {
  server.use(http.get('*/api/v1/sessions/current', () => HttpResponse.json(session)))
}

function renderRoute(path: string) {
  window.localStorage.setItem('stutrade.locale', 'zh-CN')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<AppProviders queryClient={queryClient}><RouterProvider router={router} /></AppProviders>)
  return router
}

async function fillBook(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('ISBN'), '9787115428028')
  await user.type(screen.getByLabelText('书名'), '计算机网络')
  await user.type(screen.getByLabelText('作者'), '谢希仁')
  await user.selectOptions(screen.getByLabelText('成色'), 'like_new')
  await user.type(screen.getByLabelText('备注'), '无笔记')
}

// === verify publishing behavior ===

describe('publishing', () => {
  it('protects the publishing and owned-listing routes', async () => {
    const router = renderRoute('/my-listings?type=buy')
    expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument()
    expect(router.state.location.search).toContain('returnTo=')
  })

  it('normalizes an unsupported mode and reports the first missing field', async () => {
    authenticate()
    const user = userEvent.setup()
    const router = renderRoute('/publish?type=other&unused=value')
    await screen.findByRole('heading', { name: '发布' })
    await waitFor(() => expect(router.state.location.search).toBe(''))
    await user.click(screen.getByRole('button', { name: '发布出售' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '请输入至少 10 位 ISBN。',
    )
  })

  it('switches modes through the URL while retaining shared fields and clearing price', async () => {
    authenticate()
    const user = userEvent.setup()
    const router = renderRoute('/publish')
    await screen.findByRole('heading', { name: '发布' })
    await fillBook(user)
    await user.type(screen.getByLabelText('出售价格（元）'), '32.50')
    await user.click(screen.getByRole('button', { name: '发布求购' }))
    expect(router.state.location.search).toBe('?type=buy')
    expect(screen.getByLabelText('书名')).toHaveValue('计算机网络')
    expect(screen.getByLabelText('成色')).toHaveValue('like_new')
    expect(screen.getByLabelText('备注')).toHaveValue('无笔记')
    expect(screen.getByLabelText('最高预算（元）')).toHaveValue('')
  })

  it.each([['0', '请输入大于 0'], ['1.001', '最多两位小数'], ['abc', '最多两位小数']])('rejects invalid amount %s', async (amount, message) => {
    authenticate()
    const request = vi.fn()
    server.use(http.post('*/api/v1/sell-listings', () => { request(); return new HttpResponse(null, { status: 500 }) }))
    const user = userEvent.setup()
    renderRoute('/publish')
    await screen.findByRole('heading', { name: '发布' })
    await fillBook(user)
    await user.type(screen.getByLabelText('出售价格（元）'), amount)
    await user.click(screen.getByRole('button', { name: '发布出售' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(request).not.toHaveBeenCalled()
  })

  it('submits an exact sell amount once without a cover and links to the result', async () => {
    authenticate()
    const request = vi.fn()
    let finish: (() => void) | undefined
    const pending = new Promise<void>((resolve) => { finish = resolve })
    server.use(http.post('*/api/v1/sell-listings', async ({ request: incoming }) => {
      request(await incoming.json())
      await pending
      return HttpResponse.json({ id: 'created-1', owner, book: { isbn: '9787115428028', title: '计算机网络', author: '谢希仁' }, condition: 'like_new', price: { amount: 3250, currency: 'CNY' }, note: '无笔记', status: 'open', availableActions: ['withdraw'], createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z' } satisfies components['schemas']['SellListing'], { status: 201 })
    }))
    const user = userEvent.setup()
    renderRoute('/publish')
    await screen.findByRole('heading', { name: '发布' })
    await fillBook(user)
    await user.type(screen.getByLabelText('出售价格（元）'), '32.50')
    const submission = user.dblClick(screen.getByRole('button', { name: '发布出售' }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: '发布中…' })).toBeDisabled()
    finish?.()
    await submission
    expect(await screen.findByRole('heading', { name: '出售挂单已发布' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看挂单' })).toHaveAttribute('href', '/sell-listings/created-1')
    expect(request).toHaveBeenCalledWith({ book: { isbn: '9787115428028', title: '计算机网络', author: '谢希仁' }, condition: 'like_new', price: { amount: 3250, currency: 'CNY' }, note: '无笔记' })
  })

  it('uses the distinct buy command and maps service failure', async () => {
    authenticate()
    const request = vi.fn()
    server.use(http.post('*/api/v1/buy-requests', async ({ request: incoming }) => { request(await incoming.json()); return HttpResponse.json(problem(500, 'internal_error'), { status: 500 }) }))
    const user = userEvent.setup()
    renderRoute('/publish?type=buy')
    await screen.findByRole('heading', { name: '发布' })
    await fillBook(user)
    await user.type(screen.getByLabelText('最高预算（元）'), '50')
    fireEvent.submit(screen.getByLabelText('最高预算（元）').closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('发布失败，请稍后重试。')
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ maximumPrice: { amount: 5000, currency: 'CNY' } }))
  })
})

// === verify owned-listing behavior ===

describe('my listings', () => {
  it('shows all status labels, price semantics, detail links, and action availability', async () => {
    authenticate()
    const statuses = ['open', 'reserved', 'matched', 'withdrawn'] as const
    server.use(http.get('*/api/v1/sell-listings', () => HttpResponse.json({ items: statuses.map((status, index) => ({ id: `sell-${index}`, owner, book: { isbn: `978000000000${index}`, title: `书籍${index}`, author: '作者' }, condition: 'good', price: { amount: 1000 + index, currency: 'CNY' }, status, availableActions: status === 'open' ? ['withdraw'] : [], createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z' } satisfies components['schemas']['SellListing'])), nextCursor: null })))
    renderRoute('/my-listings')
    for (const label of ['有效', '已撮合', '已成交', '已停用']) expect(await screen.findByText(label)).toBeInTheDocument()
    expect(screen.getAllByText('售价')).toHaveLength(4)
    expect(screen.getAllByRole('link', { name: '详情' })[0]).toHaveAttribute('href', '/sell-listings/sell-0')
    expect(screen.getAllByRole('button', { name: '停用发布' })).toHaveLength(1)
  })

  it('switches to buy requests and loads another cursor page', async () => {
    authenticate()
    server.use(http.get('*/api/v1/buy-requests', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor')
      return HttpResponse.json({ items: [{ id: cursor ? 'buy-2' : 'buy-1', owner, book: { isbn: '9787111544937', title: cursor ? '第二页' : '第一页', author: '作者' }, condition: 'fair', maximumPrice: { amount: 5000, currency: 'CNY' }, status: 'open', availableActions: [], createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z' } satisfies components['schemas']['BuyRequest']], nextCursor: cursor ? null : 'next' })
    }))
    const user = userEvent.setup()
    const router = renderRoute('/my-listings')
    await screen.findByRole('heading', { name: '我的发布' })
    await user.click(screen.getByRole('button', { name: '求购' }))
    expect(router.state.location.search).toBe('?type=buy')
    expect(await screen.findByText('第一页')).toBeInTheDocument()
    expect(screen.getByText('最高预算')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '加载更多' }))
    expect(await screen.findByText('第二页')).toBeInTheDocument()
  })

  it('cancels confirmation and refreshes authoritative state after withdrawal', async () => {
    authenticate()
    let status: components['schemas']['ListingStatus'] = 'open'
    const remove = vi.fn(() => { status = 'withdrawn'; return new HttpResponse(null, { status: 204 }) })
    server.use(
      http.get('*/api/v1/sell-listings', () => HttpResponse.json({ items: [{ id: 'own-1', owner, book: { isbn: '9787115428028', title: '计算机网络', author: '谢希仁' }, condition: 'good', price: { amount: 3200, currency: 'CNY' }, status, availableActions: status === 'open' ? ['withdraw'] : [], createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z' } satisfies components['schemas']['SellListing']], nextCursor: null })),
      http.delete('*/api/v1/sell-listings/own-1', remove),
    )
    const user = userEvent.setup()
    renderRoute('/my-listings')
    await user.click(await screen.findByRole('button', { name: '停用发布' }))
    const confirmation = screen.getByText('确认停用？').parentElement!
    await user.click(within(confirmation).getByRole('button', { name: '取消' }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '停用发布' }))
    await user.click(within(screen.getByText('确认停用？').parentElement!).getByRole('button', { name: '确认' }))
    expect(await screen.findByText('发布已停用。')).toBeInTheDocument()
    expect(await screen.findByText('已停用')).toBeInTheDocument()
  })

  it.each(withdrawalFailures)('maps withdrawal failure %s', async (status, code, message) => {
    authenticate()
    const item = { id: 'sell-2', owner, book: { isbn: '9787115428028', title: '计算机网络', author: '谢希仁' }, condition: 'like_new', price: { amount: 4200, currency: 'CNY' }, status: 'open', availableActions: ['withdraw'], createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z' } satisfies components['schemas']['SellListing']
    server.use(
      http.get('*/api/v1/sell-listings', () => HttpResponse.json({ items: [item], nextCursor: null })),
      http.delete('*/api/v1/sell-listings/sell-2', () => HttpResponse.json(problem(status, code), { status })),
    )
    const user = userEvent.setup()
    renderRoute('/my-listings')
    await user.click(await screen.findByRole('button', { name: '停用发布' }))
    await user.click(within(screen.getByText('确认停用？').parentElement!).getByRole('button', { name: '确认' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('shows an empty buy state', async () => {
    authenticate()
    server.use(http.get('*/api/v1/buy-requests', () => HttpResponse.json({ items: [], nextCursor: null })))
    renderRoute('/my-listings?type=buy')
    expect(await screen.findByText('还没有求购需求。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '去发布' })).toHaveAttribute('href', '/publish?type=buy')
  })

  it('keeps repeated owner withdrawal idempotent in the mock contract', async () => {
    await login({ email: 'lin@example.edu', password: 'secret123' })
    await expect(withdrawSellListing('sell-2')).resolves.toBeUndefined()
    await expect(withdrawSellListing('sell-2')).resolves.toBeUndefined()
  })
})
