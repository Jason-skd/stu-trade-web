import { describe, expectTypeOf, it } from 'vitest'

import type { components, operations } from './generated/schema'

// === define transport assertions ===

type Match = components['schemas']['Match']
type AutomaticMatch = Extract<Match, { source: 'automatic' }>
type DirectPurchaseMatch = Extract<Match, { source: 'direct_purchase' }>
type DirectAcceptanceMatch = Extract<Match, { source: 'direct_acceptance' }>
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false

// === verify openapi transport types ===

describe('OpenAPI transport types', () => {
  it('requires the delivered book when accepting a buy request', () => {
    type RequestBody = operations['acceptBuyRequest']['requestBody']['content']['application/json']

    expectTypeOf<RequestBody>().toEqualTypeOf<components['schemas']['AcceptBuyRequestInput']>()
    expectTypeOf<RequestBody>().toMatchTypeOf<{
      book: components['schemas']['Book']
      condition: components['schemas']['Condition']
    }>()
  })

  it('requires only listings that exist for each match source', () => {
    expectTypeOf<AutomaticMatch>().toMatchTypeOf<{
      sellListing: components['schemas']['SellListing']
      buyRequest: components['schemas']['BuyRequest']
    }>()
    expectTypeOf<DirectPurchaseMatch>().toMatchTypeOf<{
      sellListing: components['schemas']['SellListing']
      buyRequest?: components['schemas']['BuyRequest']
    }>()
    expectTypeOf<DirectAcceptanceMatch>().toMatchTypeOf<{
      sellListing?: components['schemas']['SellListing']
      buyRequest: components['schemas']['BuyRequest']
    }>()
    expectTypeOf<IsOptional<DirectPurchaseMatch, 'buyRequest'>>().toEqualTypeOf<true>()
    expectTypeOf<IsOptional<DirectAcceptanceMatch, 'sellListing'>>().toEqualTypeOf<true>()
  })
})
