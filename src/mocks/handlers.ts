import { http, HttpResponse } from 'msw'
import type { components } from '../api/generated/schema.ts'

// === define mock contracts ===

type Problem = components['schemas']['Problem']
type Session = components['schemas']['Session']
type LoginInput = components['schemas']['LoginInput']
type SignupInput = components['schemas']['SignupInput']
type SellListing = components['schemas']['SellListing']
type BuyRequest = components['schemas']['BuyRequest']
type CreateSellListingInput = components['schemas']['CreateSellListingInput']
type CreateBuyRequestInput = components['schemas']['CreateBuyRequestInput']
type AcceptBuyRequestInput = components['schemas']['AcceptBuyRequestInput']
type DirectTradeResult = components['schemas']['DirectTradeResult']
type Order = components['schemas']['Order']
type OrderUser = components['schemas']['OrderUser']

// === define problem fixtures ===

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
  detail: 'The requested listing does not exist.',
} satisfies Problem

const orderNotFoundProblem = {
  type: '/problems/not-found',
  title: 'Not found',
  status: 404,
  code: 'not_found',
  detail: 'The requested order does not exist.',
} satisfies Problem

const validationProblem = {
  type: '/problems/validation-failed',
  title: 'Validation failed',
  status: 400,
  code: 'validation_failed',
  detail: 'The request body is invalid.',
} satisfies Problem

// === manage mock session ===

let currentSession: Session | null = null

const knownUsers: OrderUser[] = [
  { id: 'user-1', nickname: '林同学', email: 'lin@example.edu' },
  { id: 'user-2', nickname: '陈同学', email: 'chen@example.edu' },
  { id: 'user-3', nickname: '周同学', email: 'zhou@example.edu' },
  { id: 'user-4', nickname: '吴同学', email: 'wu@example.edu' },
]

/** 清除测试之间共享的模拟会话。 */
export function resetMockSession() {
  currentSession = null
  resetMockListings()
  resetMockOrders()
}

// === define listing fixtures ===

const baseListing = {
  owner: { id: 'user-2', nickname: '陈同学' },
  book: {
    isbn: '9787040396638',
    title: '高等数学（第七版）',
    author: '同济大学数学系',
  },
  condition: 'good' as SellListing['condition'],
  status: 'open' as SellListing['status'],
  availableActions: ['purchase'] as SellListing['availableActions'],
  createdAt: '2026-09-16T08:00:00+08:00',
  updatedAt: '2026-09-16T08:00:00+08:00',
}

const initialSellListings: SellListing[] = [
  {
    ...baseListing,
    id: 'sell-1',
    price: { amount: 3250, currency: 'CNY' },
    note: '少量笔记，不影响阅读。',
  },
  {
    ...baseListing,
    id: 'sell-2',
    owner: { id: 'user-1', nickname: '林同学' },
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
]

const initialBuyRequests: BuyRequest[] = [
  {
    ...baseListing,
    id: 'buy-1',
    owner: { id: 'user-3', nickname: '周同学' },
    book: {
      isbn: '9787111544937',
      title: '深入理解计算机系统',
      author: 'Randal E. Bryant',
    },
    condition: 'fair',
    maximumPrice: { amount: 5000, currency: 'CNY' },
    availableActions: ['accept'],
  },
]

let sellListings = structuredClone(initialSellListings)
let buyRequests = structuredClone(initialBuyRequests)
let nextListingId = 1

function resetMockListings() {
  sellListings = structuredClone(initialSellListings)
  buyRequests = structuredClone(initialBuyRequests)
  nextListingId = 1
}

// === define order fixtures ===

const initialOrders: Order[] = [
  {
    id: 'order-pending-1',
    matchId: 'match-pending-1',
    book: baseListing.book,
    seller: knownUsers[1],
    buyer: knownUsers[0],
    agreedPrice: { amount: 3250, currency: 'CNY' },
    status: 'pending_delivery',
    sellerConfirmedCompletionAt: null,
    buyerConfirmedCompletionAt: null,
    createdAt: '2026-09-17T08:00:00+08:00',
    updatedAt: '2026-09-17T08:00:00+08:00',
  },
  {
    id: 'order-waiting-1',
    matchId: 'match-waiting-1',
    book: {
      isbn: '9787111544937',
      title: '深入理解计算机系统',
      author: 'Randal E. Bryant',
    },
    seller: knownUsers[0],
    buyer: knownUsers[2],
    agreedPrice: { amount: 5000, currency: 'CNY' },
    status: 'pending_delivery',
    sellerConfirmedCompletionAt: '2026-09-17T09:00:00+08:00',
    buyerConfirmedCompletionAt: null,
    createdAt: '2026-09-17T08:30:00+08:00',
    updatedAt: '2026-09-17T09:00:00+08:00',
  },
  {
    id: 'order-completed-1',
    matchId: 'match-completed-1',
    book: {
      isbn: '9787302517597',
      title: '数据结构',
      author: '严蔚敏',
    },
    seller: knownUsers[3],
    buyer: knownUsers[0],
    agreedPrice: { amount: 2800, currency: 'CNY' },
    status: 'completed',
    sellerConfirmedCompletionAt: '2026-09-17T11:00:00+08:00',
    buyerConfirmedCompletionAt: '2026-09-17T11:05:00+08:00',
    createdAt: '2026-09-17T10:00:00+08:00',
    updatedAt: '2026-09-17T11:05:00+08:00',
  },
]

let orders = structuredClone(initialOrders)
let nextTradeId = 1

function resetMockOrders() {
  orders = structuredClone(initialOrders)
  nextTradeId = 1
}

// === filter listing fixtures ===

function matchesSearch(item: SellListing | BuyRequest, request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.toLowerCase()
  const condition = url.searchParams.get('condition')
  return (
    (!q ||
      item.book.title.toLowerCase().includes(q) ||
      item.book.isbn.includes(q)) &&
    (!condition || item.condition === condition)
  )
}

function listPage<T extends SellListing | BuyRequest>(items: T[], request: Request) {
  const url = new URL(request.url)
  let filtered: T[]
  if (url.searchParams.get('mine') === 'true') {
    if (!currentSession) return null
    filtered = items.filter((item) => item.owner.id === currentSession?.user.id)
  } else {
    filtered = items.filter((item) =>
      item.status === 'open' && matchesSearch(item, request))
  }
  const cursor = Number(url.searchParams.get('cursor') ?? 0)
  const requestedLimit = Number(url.searchParams.get('limit') ?? 20)
  const start = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 20
  const next = start + limit
  return {
    items: filtered.slice(start, next),
    nextCursor: next < filtered.length ? String(next) : null,
  }
}

function now() {
  return new Date().toISOString()
}

function forbiddenProblem(): Problem {
  return { type: '/problems/forbidden', title: 'Forbidden', status: 403, code: 'forbidden', detail: 'The operation is not permitted for the current user.' }
}

function unavailableProblem(): Problem {
  return { type: '/problems/listing-unavailable', title: 'Listing unavailable', status: 409, code: 'listing_unavailable', detail: 'The listing is no longer open.' }
}

function orderConflictProblem(): Problem {
  return { type: '/problems/order-not-pending-delivery', title: 'Order conflict', status: 409, code: 'order_not_pending_delivery', detail: 'The order can no longer be confirmed.' }
}

function orderUser(user: SellListing['owner']): OrderUser {
  return knownUsers.find((candidate) => candidate.id === user.id) ?? {
    ...user,
    email: `${user.id}@example.edu`,
  }
}

function isAcceptInput(value: unknown): value is AcceptBuyRequestInput {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  if (!input.book || typeof input.book !== 'object') return false
  const book = input.book as Record<string, unknown>
  return (
    typeof book.isbn === 'string' && book.isbn.length >= 10 &&
    typeof book.title === 'string' && book.title.length > 0 &&
    typeof book.author === 'string' && book.author.length > 0 &&
    ['new', 'like_new', 'good', 'fair', 'poor'].includes(String(input.condition)) &&
    (input.note === undefined || typeof input.note === 'string')
  )
}

function withdraw<T extends SellListing | BuyRequest>(items: T[], id: string) {
  if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
  const item = items.find((candidate) => candidate.id === id)
  if (!item) return HttpResponse.json(notFoundProblem, { status: 404 })
  if (item.owner.id !== currentSession.user.id) return HttpResponse.json(forbiddenProblem(), { status: 403 })
  if (item.status === 'withdrawn') return new HttpResponse(null, { status: 204 })
  if (item.status !== 'open') return HttpResponse.json(unavailableProblem(), { status: 409 })
  item.status = 'withdrawn'
  item.availableActions = []
  item.updatedAt = now()
  return new HttpResponse(null, { status: 204 })
}

// === transact mock listings ===

function purchase(item: SellListing): DirectTradeResult | Response {
  if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
  if (item.owner.id === currentSession.user.id) {
    return HttpResponse.json(forbiddenProblem(), { status: 403 })
  }
  if (item.status !== 'open' || !item.availableActions.includes('purchase')) {
    return HttpResponse.json(unavailableProblem(), { status: 409 })
  }

  const timestamp = now()
  const sequence = nextTradeId++
  const orderId = `mock-order-${sequence}`
  item.status = 'matched'
  item.availableActions = []
  item.updatedAt = timestamp
  const order: Order = {
    id: orderId,
    matchId: `mock-match-${sequence}`,
    book: structuredClone(item.book),
    seller: orderUser(item.owner),
    buyer: currentSession.user,
    agreedPrice: item.price,
    status: 'pending_delivery',
    sellerConfirmedCompletionAt: null,
    buyerConfirmedCompletionAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const result: DirectTradeResult = {
    match: {
      id: order.matchId,
      source: 'direct_purchase',
      status: 'completed',
      sellListing: structuredClone(item),
      agreedPrice: item.price,
      sellerConfirmedAt: timestamp,
      buyerConfirmedAt: timestamp,
      orderId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    order,
  }
  orders.unshift(order)
  return result
}

function accept(item: BuyRequest, input: AcceptBuyRequestInput): DirectTradeResult | Response {
  if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
  if (item.owner.id === currentSession.user.id) {
    return HttpResponse.json(forbiddenProblem(), { status: 403 })
  }
  if (item.status !== 'open' || !item.availableActions.includes('accept')) {
    return HttpResponse.json(unavailableProblem(), { status: 409 })
  }

  const timestamp = now()
  const sequence = nextTradeId++
  const orderId = `mock-order-${sequence}`
  item.status = 'matched'
  item.availableActions = []
  item.updatedAt = timestamp
  const order: Order = {
    id: orderId,
    matchId: `mock-match-${sequence}`,
    book: structuredClone(input.book),
    seller: currentSession.user,
    buyer: orderUser(item.owner),
    agreedPrice: item.maximumPrice,
    status: 'pending_delivery',
    sellerConfirmedCompletionAt: null,
    buyerConfirmedCompletionAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const result: DirectTradeResult = {
    match: {
      id: order.matchId,
      source: 'direct_acceptance',
      status: 'completed',
      buyRequest: structuredClone(item),
      agreedPrice: item.maximumPrice,
      sellerConfirmedAt: timestamp,
      buyerConfirmedAt: timestamp,
      orderId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    order,
  }
  orders.unshift(order)
  return result
}

function orderPage(request: Request) {
  if (!currentSession) return null
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  if (status !== null && status !== 'pending_delivery' && status !== 'completed') {
    return false
  }
  const visible = orders.filter((order) =>
    (order.seller.id === currentSession?.user.id ||
      order.buyer.id === currentSession?.user.id) &&
    (!status || order.status === status))
  const cursor = Number(url.searchParams.get('cursor') ?? 0)
  const requestedLimit = Number(url.searchParams.get('limit') ?? 20)
  const start = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 20
  const next = start + limit
  return {
    items: visible.slice(start, next),
    nextCursor: next < visible.length ? String(next) : null,
  }
}

function confirmCompletion(id: string) {
  if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
  const order = orders.find((candidate) => candidate.id === id)
  if (!order) return HttpResponse.json(orderNotFoundProblem, { status: 404 })
  const role = order.seller.id === currentSession.user.id
    ? 'seller'
    : order.buyer.id === currentSession.user.id
      ? 'buyer'
      : null
  if (!role) return HttpResponse.json(forbiddenProblem(), { status: 403 })
  if (order.status === 'completed') {
    return HttpResponse.json(orderConflictProblem(), { status: 409 })
  }

  const timestamp = now()
  if (role === 'seller') order.sellerConfirmedCompletionAt ??= timestamp
  else order.buyerConfirmedCompletionAt ??= timestamp
  if (order.sellerConfirmedCompletionAt && order.buyerConfirmedCompletionAt) {
    order.status = 'completed'
  }
  order.updatedAt = timestamp
  return HttpResponse.json(order)
}

// === handle mock api requests ===

/** 模拟当前已实现的会话、市集、主动成交和订单 HTTP 契约。 */
export const handlers = [
  http.post('*/api/v1/login', async ({ request }) => {
    const input = (await request.json()) as LoginInput
    const user = knownUsers.find((candidate) => candidate.email === input.email)
    currentSession = {
      user: user ?? { id: 'user-1', nickname: '校园用户', email: input.email },
    }
    return HttpResponse.json(currentSession)
  }),
  http.post('*/api/v1/signup', async ({ request }) => {
    const input = (await request.json()) as SignupInput
    currentSession = {
      user: { id: 'user-1', nickname: input.nickname, email: input.email },
    }
    return HttpResponse.json(currentSession, { status: 201 })
  }),
  http.get('*/api/v1/sessions/current', () => {
    if (currentSession) return HttpResponse.json(currentSession)
    return HttpResponse.json(unauthenticatedProblem, {
      status: 401,
      headers: { 'Content-Type': 'application/problem+json' },
    })
  }),
  http.delete('*/api/v1/sessions/current', () => {
    currentSession = null
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('*/api/v1/sell-listings', ({ request }) => {
    const page = listPage(sellListings, request)
    return page
      ? HttpResponse.json(page)
      : HttpResponse.json(unauthenticatedProblem, { status: 401 })
  }),
  http.get('*/api/v1/buy-requests', ({ request }) => {
    const page = listPage(buyRequests, request)
    return page
      ? HttpResponse.json(page)
      : HttpResponse.json(unauthenticatedProblem, { status: 401 })
  }),
  http.post('*/api/v1/sell-listings', async ({ request }) => {
    if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
    const input = (await request.json()) as CreateSellListingInput
    const timestamp = now()
    const owner = {
      id: currentSession.user.id,
      nickname: currentSession.user.nickname,
    }
    const item: SellListing = {
      ...input, id: `mock-sell-${nextListingId++}`, owner, status: 'open',
      availableActions: ['withdraw'], createdAt: timestamp, updatedAt: timestamp,
    }
    sellListings.unshift(item)
    return HttpResponse.json(item, { status: 201 })
  }),
  http.post('*/api/v1/buy-requests', async ({ request }) => {
    if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
    const input = (await request.json()) as CreateBuyRequestInput
    const timestamp = now()
    const owner = {
      id: currentSession.user.id,
      nickname: currentSession.user.nickname,
    }
    const item: BuyRequest = {
      ...input, id: `mock-buy-${nextListingId++}`, owner, status: 'open',
      availableActions: ['withdraw'], createdAt: timestamp, updatedAt: timestamp,
    }
    buyRequests.unshift(item)
    return HttpResponse.json(item, { status: 201 })
  }),
  http.get('*/api/v1/sell-listings/:id', ({ params }) => {
    const item = sellListings.find((listing) => listing.id === params.id)
    return item
      ? HttpResponse.json(item)
      : HttpResponse.json(notFoundProblem, { status: 404 })
  }),
  http.get('*/api/v1/buy-requests/:id', ({ params }) => {
    const item = buyRequests.find((listing) => listing.id === params.id)
    return item
      ? HttpResponse.json(item)
      : HttpResponse.json(notFoundProblem, { status: 404 })
  }),
  http.delete('*/api/v1/sell-listings/:id', ({ params }) => withdraw(sellListings, String(params.id))),
  http.delete('*/api/v1/buy-requests/:id', ({ params }) => withdraw(buyRequests, String(params.id))),
  http.post('*/api/v1/sell-listings/:id/purchase', ({ params }) => {
    if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
    const item = sellListings.find((listing) => listing.id === params.id)
    if (!item) return HttpResponse.json(notFoundProblem, { status: 404 })
    const result = purchase(item)
    return result instanceof Response
      ? result
      : HttpResponse.json(result, { status: 201 })
  }),
  http.post('*/api/v1/buy-requests/:id/accept', async ({ params, request }) => {
    if (!currentSession) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
    const item = buyRequests.find((listing) => listing.id === params.id)
    if (!item) return HttpResponse.json(notFoundProblem, { status: 404 })
    const input: unknown = await request.json()
    if (!isAcceptInput(input)) {
      return HttpResponse.json(validationProblem, { status: 400 })
    }
    const result = accept(item, input)
    return result instanceof Response
      ? result
      : HttpResponse.json(result, { status: 201 })
  }),
  http.get('*/api/v1/orders', ({ request }) => {
    const page = orderPage(request)
    if (page === null) return HttpResponse.json(unauthenticatedProblem, { status: 401 })
    if (page === false) return HttpResponse.json(validationProblem, { status: 400 })
    return HttpResponse.json(page)
  }),
  http.post('*/api/v1/orders/:id/confirm-completion', ({ params }) =>
    confirmCompletion(String(params.id))),
]
