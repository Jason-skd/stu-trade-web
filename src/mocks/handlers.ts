import { http, HttpResponse } from 'msw'
import type { components } from '../api/generated/schema.ts'

// === define mock contracts ===

type Problem = components['schemas']['Problem']
type Session = components['schemas']['Session']
type LoginInput = components['schemas']['LoginInput']
type SignupInput = components['schemas']['SignupInput']
type SellListing = components['schemas']['SellListing']
type BuyRequest = components['schemas']['BuyRequest']
type DirectTradeResult = components['schemas']['DirectTradeResult']
type Order = components['schemas']['Order']
type OrderUser = components['schemas']['OrderUser']

// === define protocol fixtures ===

const fixtureTime = '2026-09-17T08:00:00+08:00'
const confirmedTime = '2026-09-17T09:00:00+08:00'

const users = {
  buyer: { id: 'user-1', nickname: '林同学', email: 'lin@example.edu' },
  seller: { id: 'user-2', nickname: '陈同学', email: 'chen@example.edu' },
  requester: { id: 'user-3', nickname: '周同学', email: 'zhou@example.edu' },
  completedSeller: { id: 'user-4', nickname: '吴同学', email: 'wu@example.edu' },
} satisfies Record<string, OrderUser>

const baseListing = {
  owner: { id: users.seller.id, nickname: users.seller.nickname },
  book: {
    isbn: '9787040396638',
    title: '高等数学（第七版）',
    author: '同济大学数学系',
  },
  condition: 'good' as SellListing['condition'],
  status: 'open' as SellListing['status'],
  availableActions: ['purchase'] as SellListing['availableActions'],
  createdAt: fixtureTime,
  updatedAt: fixtureTime,
}

const sellListings = [
  {
    ...baseListing,
    id: 'sell-1',
    price: { amount: 3250, currency: 'CNY' },
    note: '少量笔记，不影响阅读。',
  },
  {
    ...baseListing,
    id: 'sell-2',
    owner: { id: users.buyer.id, nickname: users.buyer.nickname },
    book: {
      isbn: '9787115428028',
      title: '计算机网络',
      author: '谢希仁',
    },
    condition: 'like_new',
    price: { amount: 4200, currency: 'CNY' },
    availableActions: ['withdraw'],
  },
  {
    ...baseListing,
    id: 'sell-3',
    book: {
      isbn: '9787302517597',
      title: '数据结构',
      author: '严蔚敏',
    },
    price: { amount: 2800, currency: 'CNY' },
    status: 'withdrawn',
    availableActions: [],
  },
] satisfies SellListing[]

const buyRequests = [
  {
    ...baseListing,
    id: 'buy-1',
    owner: { id: users.requester.id, nickname: users.requester.nickname },
    book: {
      isbn: '9787111544937',
      title: '深入理解计算机系统',
      author: 'Randal E. Bryant',
    },
    condition: 'fair',
    maximumPrice: { amount: 5000, currency: 'CNY' },
    availableActions: ['accept'],
  },
] satisfies BuyRequest[]

const pendingOrders = [
  {
    id: 'order-pending-1',
    matchId: 'match-pending-1',
    book: baseListing.book,
    seller: users.seller,
    buyer: users.buyer,
    agreedPrice: { amount: 3250, currency: 'CNY' },
    status: 'pending_delivery',
    sellerConfirmedCompletionAt: null,
    buyerConfirmedCompletionAt: null,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
  },
  {
    id: 'order-waiting-1',
    matchId: 'match-waiting-1',
    book: buyRequests[0].book,
    seller: users.buyer,
    buyer: users.requester,
    agreedPrice: { amount: 5000, currency: 'CNY' },
    status: 'pending_delivery',
    sellerConfirmedCompletionAt: confirmedTime,
    buyerConfirmedCompletionAt: null,
    createdAt: fixtureTime,
    updatedAt: confirmedTime,
  },
] satisfies Order[]

const completedOrder = {
  id: 'order-completed-1',
  matchId: 'match-completed-1',
  book: sellListings[2].book,
  seller: users.completedSeller,
  buyer: users.buyer,
  agreedPrice: { amount: 2800, currency: 'CNY' },
  status: 'completed',
  sellerConfirmedCompletionAt: confirmedTime,
  buyerConfirmedCompletionAt: '2026-09-17T09:05:00+08:00',
  createdAt: fixtureTime,
  updatedAt: '2026-09-17T09:05:00+08:00',
} satisfies Order

const confirmedOrder = {
  ...pendingOrders[0],
  buyerConfirmedCompletionAt: confirmedTime,
  updatedAt: confirmedTime,
} satisfies Order

const directPurchase = {
  match: {
    id: 'match-direct-purchase',
    source: 'direct_purchase',
    status: 'completed',
    sellListing: { ...sellListings[0], status: 'matched', availableActions: [] },
    agreedPrice: sellListings[0].price,
    sellerConfirmedAt: fixtureTime,
    buyerConfirmedAt: fixtureTime,
    orderId: pendingOrders[0].id,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
  },
  order: pendingOrders[0],
} satisfies DirectTradeResult

const directAcceptance = {
  match: {
    id: 'match-direct-acceptance',
    source: 'direct_acceptance',
    status: 'completed',
    buyRequest: { ...buyRequests[0], status: 'matched', availableActions: [] },
    agreedPrice: buyRequests[0].maximumPrice,
    sellerConfirmedAt: fixtureTime,
    buyerConfirmedAt: fixtureTime,
    orderId: pendingOrders[1].id,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
  },
  order: pendingOrders[1],
} satisfies DirectTradeResult

const createdSellListing = {
  ...sellListings[1],
  id: 'created-sell-1',
} satisfies SellListing

const createdBuyRequest = {
  ...buyRequests[0],
  id: 'created-buy-1',
  owner: { id: users.buyer.id, nickname: users.buyer.nickname },
  availableActions: ['withdraw'],
} satisfies BuyRequest

const unauthenticatedProblem = {
  type: '/problems/unauthenticated',
  title: 'Unauthenticated',
  status: 401,
  code: 'unauthenticated',
  detail: 'A valid session is required.',
} satisfies Problem

const notFoundProblem = {
  type: '/problems/not-found',
  title: 'Not found',
  status: 404,
  code: 'not_found',
  detail: 'The requested fixture does not exist.',
} satisfies Problem

// === manage session fixture ===

let currentSession: Session | null = null

/** 清除测试之间共享的模拟会话。 */
export function resetMockSession() {
  currentSession = null
}

function sessionFor(email: string, nickname = '校园用户'): Session {
  const knownUser = Object.values(users).find((user) => user.email === email)
  return {
    user: knownUser ?? { id: 'user-fixture', nickname, email },
  }
}

// === select response fixtures ===

function listingPage<T>(request: Request, publicItems: T[], ownedItems: T[]) {
  const mine = new URL(request.url).searchParams.get('mine') === 'true'
  return { items: mine ? ownedItems : publicItems, nextCursor: null }
}

function listingById<T extends { id: string }>(items: T[], id: string | readonly string[] | undefined) {
  return items.find((item) => item.id === id)
}

// === handle mock api requests ===

/** 提供用于界面开发和测试的确定性 HTTP 协议夹具。 */
export const handlers = [
  http.post('*/api/v1/login', async ({ request }) => {
    const input = (await request.json()) as LoginInput
    currentSession = sessionFor(input.email)
    return HttpResponse.json(currentSession)
  }),
  http.post('*/api/v1/signup', async ({ request }) => {
    const input = (await request.json()) as SignupInput
    currentSession = sessionFor(input.email, input.nickname)
    return HttpResponse.json(currentSession, { status: 201 })
  }),
  http.get('*/api/v1/sessions/current', () => currentSession
    ? HttpResponse.json(currentSession)
    : HttpResponse.json(unauthenticatedProblem, {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      })),
  http.delete('*/api/v1/sessions/current', () => {
    currentSession = null
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('*/api/v1/sell-listings', ({ request }) => HttpResponse.json(
    listingPage(request, sellListings.slice(0, 2), [sellListings[1]]),
  )),
  http.get('*/api/v1/buy-requests', ({ request }) => HttpResponse.json(
    listingPage(request, buyRequests, []),
  )),
  http.post('*/api/v1/sell-listings', () =>
    HttpResponse.json(createdSellListing, { status: 201 })),
  http.post('*/api/v1/buy-requests', () =>
    HttpResponse.json(createdBuyRequest, { status: 201 })),
  http.get('*/api/v1/sell-listings/:id', ({ params }) => {
    const item = listingById(sellListings, params.id)
    return item
      ? HttpResponse.json(item)
      : HttpResponse.json(notFoundProblem, { status: 404 })
  }),
  http.get('*/api/v1/buy-requests/:id', ({ params }) => {
    const item = listingById(buyRequests, params.id)
    return item
      ? HttpResponse.json(item)
      : HttpResponse.json(notFoundProblem, { status: 404 })
  }),
  http.delete('*/api/v1/sell-listings/:id', () =>
    new HttpResponse(null, { status: 204 })),
  http.delete('*/api/v1/buy-requests/:id', () =>
    new HttpResponse(null, { status: 204 })),
  http.post('*/api/v1/sell-listings/:id/purchase', () =>
    HttpResponse.json(directPurchase, { status: 201 })),
  http.post('*/api/v1/buy-requests/:id/accept', () =>
    HttpResponse.json(directAcceptance, { status: 201 })),
  http.get('*/api/v1/orders', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    const items = status === 'completed' ? [completedOrder] : pendingOrders
    return HttpResponse.json({ items, nextCursor: null })
  }),
  http.post('*/api/v1/orders/:id/confirm-completion', () =>
    HttpResponse.json(confirmedOrder)),
]
