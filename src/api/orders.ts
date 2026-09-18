import type { components } from './generated/schema.ts'
import { apiProblemFrom } from './problem.ts'

// === define order contracts ===

/** 接受求购时登记的实际交付书籍。 */
export type AcceptBuyRequestInput =
  components['schemas']['AcceptBuyRequestInput']

/** 主动成交后服务端返回的撮合与订单。 */
export type DirectTradeResult = components['schemas']['DirectTradeResult']

/** 当前用户可见的订单。 */
export type Order = components['schemas']['Order']

/** 订单的履约状态。 */
export type OrderStatus = components['schemas']['OrderStatus']

type OrderPage = components['schemas']['OrderPage']

// === request order resources ===

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(`/api/v1${path}`, window.location.origin), {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json, application/problem+json',
      ...init?.headers,
    },
  })

  if (!response.ok) throw await apiProblemFrom(response)
  return (await response.json()) as T
}

/** 按挂单固定售价直接购买。 */
export function purchaseSellListing(id: string) {
  return request<DirectTradeResult>(
    `/sell-listings/${encodeURIComponent(id)}/purchase`,
    { method: 'POST' },
  )
}

/** 按求购预算接受需求并登记实际交付书籍。 */
export function acceptBuyRequest(id: string, input: AcceptBuyRequestInput) {
  return request<DirectTradeResult>(
    `/buy-requests/${encodeURIComponent(id)}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

/** 读取当前用户指定状态的一页订单。 */
export function listOrders(status: OrderStatus, cursor?: string) {
  const params = new URLSearchParams({ status })
  if (cursor) params.set('cursor', cursor)
  return request<OrderPage>(`/orders?${params}`)
}

/** 确认当前用户已完成一笔订单的线下交付。 */
export function confirmOrderCompletion(id: string) {
  return request<Order>(`/orders/${encodeURIComponent(id)}/confirm-completion`, {
    method: 'POST',
  })
}
