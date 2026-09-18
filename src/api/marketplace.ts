import type { components } from './generated/schema.ts'
import { apiProblemFrom } from './problem.ts'

// === define marketplace contracts ===

/** 市集中的挂单方向。 */
export type MarketplaceKind = 'sell' | 'buy'

/** OpenAPI 定义的书籍成色。 */
export type Condition = components['schemas']['Condition']
type SellListing = components['schemas']['SellListing']
type BuyRequest = components['schemas']['BuyRequest']

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

async function request<T>(path: string): Promise<T> {
  const response = await fetch(new URL(`/api/v1${path}`, window.location.origin), {
    credentials: 'include',
    headers: { Accept: 'application/json, application/problem+json' },
  })

  if (!response.ok) {
    throw await apiProblemFrom(response)
  }

  return (await response.json()) as T
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
