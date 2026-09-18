import { describe, expect, it } from 'vitest'
import { getMarketplaceListing } from './marketplace.ts'
import {
  acceptBuyRequest,
  confirmOrderCompletion,
  listOrders,
  purchaseSellListing,
} from './orders.ts'
import { login } from './session.ts'

// === define mock api input ===

const actualBook = {
  book: {
    isbn: '9787111544937',
    title: '深入理解计算机系统（实物）',
    author: 'Randal E. Bryant',
  },
  condition: 'good',
  note: '封面有折痕',
} as const

async function authenticate(email = 'lin@example.edu') {
  await login({ email, password: 'secret123' })
}

// === verify direct-trade mock contract ===

describe('order API mock contract', () => {
  it('creates one direct-purchase order at the seller price and consumes the listing', async () => {
    await authenticate()

    const result = await purchaseSellListing('sell-1')
    expect(result.match.source).toBe('direct_purchase')
    expect(result.match.status).toBe('completed')
    expect(result.order.agreedPrice.amount).toBe(3250)
    expect(result.order.buyer.id).toBe('user-1')
    expect(result.order.seller.id).toBe('user-2')
    expect((await getMarketplaceListing('sell', 'sell-1')).status).toBe('matched')
    await expect(purchaseSellListing('sell-1')).rejects.toMatchObject({
      problem: { status: 409, code: 'listing_unavailable' },
    })
    const orders = await listOrders('pending_delivery')
    expect(orders.items.filter((order) => order.id === result.order.id)).toHaveLength(1)
  })

  it('creates one direct-acceptance order from the actual book at the buyer budget', async () => {
    await authenticate()

    const result = await acceptBuyRequest('buy-1', actualBook)
    expect(result.match.source).toBe('direct_acceptance')
    expect(result.order.book).toEqual(actualBook.book)
    expect(result.order.agreedPrice.amount).toBe(5000)
    expect(result.order.seller.id).toBe('user-1')
    expect(result.order.buyer.id).toBe('user-3')
    expect((await getMarketplaceListing('buy', 'buy-1')).status).toBe('matched')
    await expect(acceptBuyRequest('buy-1', actualBook)).rejects.toMatchObject({
      problem: { status: 409 },
    })
  })

  it('rejects self-trades, inactive listings, and invalid actual-book input', async () => {
    await authenticate()
    await expect(purchaseSellListing('sell-2')).rejects.toMatchObject({
      problem: { status: 403 },
    })
    await expect(purchaseSellListing('sell-3')).rejects.toMatchObject({
      problem: { status: 409 },
    })

    const response = await fetch('/api/v1/buy-requests/buy-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book: {}, condition: 'unknown' }),
    })
    expect(response.status).toBe(400)

    await authenticate('zhou@example.edu')
    await expect(acceptBuyRequest('buy-1', actualBook)).rejects.toMatchObject({
      problem: { status: 403 },
    })
  })

  it('filters and paginates only participant orders', async () => {
    await authenticate()
    const pending = await listOrders('pending_delivery')
    const completed = await listOrders('completed')
    expect(pending.items.every((order) => order.status === 'pending_delivery')).toBe(true)
    expect(completed.items.every((order) => order.status === 'completed')).toBe(true)

    const first = await fetch('/api/v1/orders?status=pending_delivery&limit=1')
    const firstPage = await first.json() as { items: unknown[]; nextCursor: string | null }
    expect(firstPage.items).toHaveLength(1)
    expect(firstPage.nextCursor).toBe('1')
    const second = await fetch(`/api/v1/orders?status=pending_delivery&limit=1&cursor=${firstPage.nextCursor}`)
    const secondPage = await second.json() as { items: unknown[]; nextCursor: string | null }
    expect(secondPage.items).toHaveLength(1)
  })

  it('lets both participants confirm and rejects a non-participant', async () => {
    await authenticate('zhou@example.edu')
    await expect(confirmOrderCompletion('order-pending-1')).rejects.toMatchObject({
      problem: { status: 403 },
    })

    await authenticate()
    const buyerConfirmation = await confirmOrderCompletion('order-pending-1')
    expect(buyerConfirmation.status).toBe('pending_delivery')
    expect(buyerConfirmation.buyerConfirmedCompletionAt).not.toBeNull()

    await authenticate('chen@example.edu')
    const sellerConfirmation = await confirmOrderCompletion('order-pending-1')
    expect(sellerConfirmation.status).toBe('completed')
    expect(sellerConfirmation.sellerConfirmedCompletionAt).not.toBeNull()
    await expect(confirmOrderCompletion('order-pending-1')).rejects.toMatchObject({
      problem: { status: 409, code: 'order_not_pending_delivery' },
    })
  })
})
