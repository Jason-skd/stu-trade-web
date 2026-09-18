import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { components } from './generated/schema.ts'
import {
  acceptBuyRequest,
  confirmOrderCompletion,
  listOrders,
  purchaseSellListing,
} from './orders.ts'
import { server } from '../mocks/server.ts'

// === define transport fixtures ===

const order = {
  id: 'order-1',
  matchId: 'match-1',
  book: {
    isbn: '9787040396638',
    title: '高等数学（第七版）',
    author: '同济大学数学系',
  },
  seller: { id: 'seller-1', nickname: '陈同学', email: 'chen@example.edu' },
  buyer: { id: 'buyer-1', nickname: '林同学', email: 'lin@example.edu' },
  agreedPrice: { amount: 3250, currency: 'CNY' },
  status: 'pending_delivery',
  sellerConfirmedCompletionAt: null,
  buyerConfirmedCompletionAt: null,
  createdAt: '2026-09-18T00:00:00Z',
  updatedAt: '2026-09-18T00:00:00Z',
} satisfies components['schemas']['Order']

const directTrade = {
  match: {
    id: 'match-1',
    source: 'direct_purchase',
    status: 'completed',
    sellListing: {
      id: 'sell-1',
      owner: { id: 'seller-1', nickname: '陈同学' },
      book: order.book,
      condition: 'good',
      price: order.agreedPrice,
      status: 'matched',
      availableActions: [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    agreedPrice: order.agreedPrice,
    sellerConfirmedAt: order.createdAt,
    buyerConfirmedAt: order.createdAt,
    orderId: order.id,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  },
  order,
} satisfies components['schemas']['DirectTradeResult']

const actualBook = {
  book: {
    isbn: '9787111544937',
    title: '深入理解计算机系统（实物）',
    author: 'Randal E. Bryant',
  },
  condition: 'good',
  note: '封面有折痕',
} satisfies components['schemas']['AcceptBuyRequestInput']

// === verify order transport requests ===

describe('order API transport', () => {
  it('posts a direct purchase to the encoded listing resource', async () => {
    const request = vi.fn()
    server.use(http.post('*/api/v1/sell-listings/:id/purchase', ({ params, request: incoming }) => {
      request(params.id, incoming.headers.get('accept'))
      return HttpResponse.json(directTrade, { status: 201 })
    }))

    await expect(purchaseSellListing('sell/1')).resolves.toEqual(directTrade)
    expect(request).toHaveBeenCalledWith(
      'sell/1',
      'application/json, application/problem+json',
    )
  })

  it('serializes the actual-book input for direct acceptance', async () => {
    const request = vi.fn()
    server.use(http.post('*/api/v1/buy-requests/:id/accept', async ({ params, request: incoming }) => {
      request(
        params.id,
        incoming.headers.get('content-type'),
        await incoming.json(),
      )
      return HttpResponse.json(directTrade, { status: 201 })
    }))

    await expect(acceptBuyRequest('buy-1', actualBook)).resolves.toEqual(directTrade)
    expect(request).toHaveBeenCalledWith('buy-1', 'application/json', actualBook)
  })

  it('encodes the requested order status and cursor', async () => {
    const request = vi.fn()
    server.use(http.get('*/api/v1/orders', ({ request: incoming }) => {
      request(new URL(incoming.url).searchParams)
      return HttpResponse.json({ items: [order], nextCursor: null })
    }))

    await expect(listOrders('pending_delivery', 'next page')).resolves.toEqual({
      items: [order],
      nextCursor: null,
    })
    const params = request.mock.calls[0]?.[0] as URLSearchParams
    expect(Object.fromEntries(params)).toEqual({
      status: 'pending_delivery',
      cursor: 'next page',
    })
  })

  it('posts completion confirmation and preserves a structured failure identity', async () => {
    const request = vi.fn()
    server.use(http.post('*/api/v1/orders/:id/confirm-completion', ({ params }) => {
      request(params.id)
      return HttpResponse.json({
        type: '/problems/order-not-pending-delivery',
        title: 'Order conflict',
        status: 409,
        code: 'order_not_pending_delivery',
        detail: 'The order can no longer be confirmed.',
      } satisfies components['schemas']['Problem'], { status: 409 })
    }))

    await expect(confirmOrderCompletion('order-1')).rejects.toMatchObject({
      problem: { code: 'order_not_pending_delivery' },
    })
    expect(request).toHaveBeenCalledWith('order-1')
  })
})
