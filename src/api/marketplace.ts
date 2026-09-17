import type { components } from './generated/schema.ts'

export type MarketplaceKind = 'sell' | 'buy'
export type Condition = components['schemas']['Condition']
export type SellListing = components['schemas']['SellListing']
export type BuyRequest = components['schemas']['BuyRequest']
export type MarketplaceListing = SellListing | BuyRequest
export type MarketplacePage =
  | components['schemas']['SellListingPage']
  | components['schemas']['BuyRequestPage']

export type MarketplaceFilters = {
  kind: MarketplaceKind
  query: string
  condition?: Condition
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(new URL(`/api/v1${path}`, window.location.origin), {
    credentials: 'include',
    headers: { Accept: 'application/json, application/problem+json' },
  })

  if (!response.ok) {
    throw new Error(`Marketplace request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export function listMarketplace(filters: MarketplaceFilters, cursor?: string) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.condition) params.set('condition', filters.condition)
  if (cursor) params.set('cursor', cursor)
  const resource = filters.kind === 'sell' ? 'sell-listings' : 'buy-requests'
  return request<MarketplacePage>(`/${resource}${params.size ? `?${params}` : ''}`)
}

export function getMarketplaceListing(kind: MarketplaceKind, id: string) {
  const resource = kind === 'sell' ? 'sell-listings' : 'buy-requests'
  return request<MarketplaceListing>(`/${resource}/${encodeURIComponent(id)}`)
}
