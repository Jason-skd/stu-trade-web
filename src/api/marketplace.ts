import type { components } from './generated/schema.ts'
import { apiProblemFrom } from './problem.ts'

// === define marketplace contracts ===

/** 市集中的挂单方向。 */
export type MarketplaceKind = 'sell' | 'buy'

/** OpenAPI 定义的书籍成色。 */
export type Condition = components['schemas']['Condition']
export type SellListing = components['schemas']['SellListing']
export type BuyRequest = components['schemas']['BuyRequest']
export type CreateSellListingInput =
  components['schemas']['CreateSellListingInput']
export type CreateBuyRequestInput =
  components['schemas']['CreateBuyRequestInput']

/** 市集可展示的出售或求购挂单。 */
export type MarketplaceListing = SellListing | BuyRequest
type MarketplacePage =
  | components['schemas']['SellListingPage']
  | components['schemas']['BuyRequestPage']

type MarketplaceFilters = {
  kind: MarketplaceKind
  query: string
  condition?: Condition
}

// === request marketplace resources ===

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(`/api/v1${path}`, window.location.origin), {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json, application/problem+json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw await apiProblemFrom(response)
  }

  return (await response.json()) as T
}

async function requestEmpty(path: string, init: RequestInit) {
  const response = await fetch(new URL(`/api/v1${path}`, window.location.origin), {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/problem+json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw await apiProblemFrom(response)
  }
}

/** 按筛选条件读取一页在售或求购挂单。 */
export function listMarketplace(filters: MarketplaceFilters, cursor?: string) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.condition) params.set('condition', filters.condition)
  if (cursor) params.set('cursor', cursor)
  const resource = filters.kind === 'sell' ? 'sell-listings' : 'buy-requests'
  return request<MarketplacePage>(`/${resource}${params.size ? `?${params}` : ''}`)
}

/** 读取指定类型和标识的挂单详情。 */
export function getMarketplaceListing(kind: MarketplaceKind, id: string) {
  const resource = kind === 'sell' ? 'sell-listings' : 'buy-requests'
  return request<MarketplaceListing>(`/${resource}/${encodeURIComponent(id)}`)
}

// === manage owned marketplace resources ===

/** 发布一条出售挂单。 */
export function createSellListing(input: CreateSellListingInput) {
  return request<SellListing>('/sell-listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** 发布一条求购需求。 */
export function createBuyRequest(input: CreateBuyRequestInput) {
  return request<BuyRequest>('/buy-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** 读取当前用户指定类型的一页挂单。 */
export function listMyListings(kind: MarketplaceKind, cursor?: string) {
  const params = new URLSearchParams({ mine: 'true' })
  if (cursor) params.set('cursor', cursor)
  const resource = kind === 'sell' ? 'sell-listings' : 'buy-requests'
  return request<MarketplacePage>(`/${resource}?${params}`)
}

/** 停用当前用户的一条出售挂单。 */
export function withdrawSellListing(id: string) {
  return requestEmpty(`/sell-listings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** 停用当前用户的一条求购需求。 */
export function withdrawBuyRequest(id: string) {
  return requestEmpty(`/buy-requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
