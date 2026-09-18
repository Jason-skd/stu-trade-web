import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookCheck, BookOpen } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createBuyRequest,
  createSellListing,
  listMyListings,
  withdrawBuyRequest,
  withdrawSellListing,
  type Condition,
  type MarketplaceKind,
  type MarketplaceListing,
} from '../../api/marketplace.ts'
import { ApiProblem } from '../../api/problem.ts'
import { useLocale } from '../../app/locale-context.ts'
import type { Messages } from '../../app/messages.ts'
import { Page } from '../../shared/components/Page.tsx'
import './owned-listings.css'

// === define owned listing presentation ===

const conditions: Condition[] = ['new', 'like_new', 'good', 'fair', 'poor']

function kindFrom(params: URLSearchParams): MarketplaceKind {
  return params.get('type') === 'buy' ? 'buy' : 'sell'
}

function parseAmount(value: string) {
  const normalized = value.trim()
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null
  const [yuan, fraction = ''] = normalized.split('.')
  const amount = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

type PublishError = keyof Messages['publish']['errors']

class FieldError extends Error {
  readonly code: PublishError

  constructor(code: PublishError) {
    super(code)
    this.code = code
  }
}

async function invalidateListings(queryClient: ReturnType<typeof useQueryClient>, kind?: MarketplaceKind, id?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
    queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
    ...(kind && id
      ? [queryClient.invalidateQueries({ queryKey: ['marketplace-detail', kind, id] })]
      : []),
  ])
}

// === publish owned listing ===

/** 渲染出售和求购共用书籍字段的发布登记单。 */
export function PublishPage() {
  const { messages } = useLocale()
  const [params, setParams] = useSearchParams()
  const kind = kindFrom(params)
  const [price, setPrice] = useState('')
  const [fieldError, setFieldError] = useState<PublishError | null>(null)
  const [serviceError, setServiceError] = useState(false)
  const [created, setCreated] = useState<{
    kind: MarketplaceKind
    listing: MarketplaceListing
  } | null>(null)
  const submitting = useRef(false)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ form, submittedKind }: {
      form: HTMLFormElement
      submittedKind: MarketplaceKind
    }) => {
      const data = new FormData(form)
      const amount = parseAmount(price)
      const book = {
        isbn: String(data.get('isbn') ?? '').trim(),
        title: String(data.get('title') ?? '').trim(),
        author: String(data.get('author') ?? '').trim(),
      }
      if (book.isbn.length < 10) throw new FieldError('shortIsbn')
      if (!book.title) throw new FieldError('missingTitle')
      if (!book.author) throw new FieldError('missingAuthor')
      if (amount === null) throw new FieldError('invalidAmount')
      const condition = String(data.get('condition')) as Condition
      const note = String(data.get('note') ?? '').trim() || undefined
      const listing = submittedKind === 'sell'
        ? await createSellListing({ book, condition, price: { amount, currency: 'CNY' }, note })
        : await createBuyRequest({ book, condition, maximumPrice: { amount, currency: 'CNY' }, note })
      return { kind: submittedKind, listing }
    },
    onSuccess: async (result) => {
      setCreated(result)
      await invalidateListings(queryClient)
    },
  })

  useEffect(() => {
    const normalized = kind === 'buy' ? 'type=buy' : ''
    if (params.toString() !== normalized) {
      setParams(normalized, { replace: true })
    }
  }, [kind, params, setParams])

  function switchKind(next: MarketplaceKind) {
    if (mutation.isPending) return
    setParams(next === 'buy' ? { type: 'buy' } : {})
    setPrice('')
    setFieldError(null)
    setServiceError(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    setFieldError(null)
    setServiceError(false)
    submitting.current = true
    try {
      await mutation.mutateAsync({ form: event.currentTarget, submittedKind: kind })
    } catch (error) {
      if (error instanceof FieldError) setFieldError(error.code)
      else setServiceError(true)
    } finally {
      submitting.current = false
    }
  }

  if (created) {
    const resource = created.kind === 'sell' ? 'sell-listings' : 'buy-requests'
    return (
      <Page title={messages.publish.successTitle}>
        <section className={`publish-success publish-success--${created.kind}`} aria-live="polite">
          <BookCheck aria-hidden="true" />
          <h2>{created.kind === 'sell' ? messages.publish.sellSuccess : messages.publish.buySuccess}</h2>
          <p>{messages.publish.successDetail(created.listing.book.title)}</p>
          <div className="publish-success__actions">
            <Link to={`/${resource}/${created.listing.id}`}>{messages.publish.viewListing}</Link>
            <button type="button" onClick={() => { setCreated(null); setPrice('') }}>{messages.publish.publishAnother}</button>
          </div>
        </section>
      </Page>
    )
  }

  return (
    <Page title={messages.publish.title}>
      <nav className="owned-tabs" aria-label={messages.publish.typeNavigation}>
        <button type="button" disabled={mutation.isPending} aria-current={kind === 'sell' ? 'page' : undefined} onClick={() => switchKind('sell')}>{messages.publish.sellBook}</button>
        <button type="button" disabled={mutation.isPending} aria-current={kind === 'buy' ? 'page' : undefined} onClick={() => switchKind('buy')}>{messages.publish.requestBook}</button>
      </nav>
      <form className={`publish-form publish-form--${kind}`} noValidate onSubmit={submit}>
        <fieldset>
          <legend>{messages.publish.bookInformation}</legend>
          <label>ISBN<input name="isbn" required minLength={10} /></label>
          <label>{messages.publish.titleLabel}<input name="title" required /></label>
          <label>{messages.publish.author}<input name="author" required /></label>
        </fieldset>
        <fieldset>
          <legend>{messages.publish.conditionAndNotes}</legend>
          <label>{messages.marketplace.condition}<select name="condition" defaultValue="good">{conditions.map((value) => <option key={value} value={value}>{messages.common.condition[value]}</option>)}</select></label>
          <label>{messages.publish.note}<textarea name="note" rows={4} /></label>
        </fieldset>
        <fieldset>
          <legend>{messages.publish.price}</legend>
          <label>{kind === 'sell' ? messages.publish.sellPrice : messages.publish.maximumPrice}<input inputMode="decimal" name="price" value={price} onChange={(event) => setPrice(event.target.value)} aria-describedby="price-guidance" /></label>
          <small id="price-guidance">{messages.publish.priceGuidance}</small>
        </fieldset>
        {fieldError && <p className="form-message" role="alert">{messages.publish.errors[fieldError]}</p>}
        {serviceError && <p className="form-message" role="alert">{messages.publish.errors.unavailable}</p>}
        <button className="publish-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? messages.publish.publishing : kind === 'sell' ? messages.publish.publishSale : messages.publish.publishRequest}</button>
      </form>
    </Page>
  )
}

// === manage owned listings ===

type WithdrawError = keyof Messages['owned']['errors']

function withdrawFailure(error: unknown): WithdrawError {
  if (error instanceof ApiProblem && error.problem.status === 403) return 'forbidden'
  if (error instanceof ApiProblem && error.problem.status === 409) return 'conflict'
  return 'unavailable'
}

function OwnedRow({ kind, listing }: { kind: MarketplaceKind; listing: MarketplaceListing }) {
  const { formatMoney, messages } = useLocale()
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<'success' | WithdrawError | null>(null)
  const queryClient = useQueryClient()
  const resource = kind === 'sell' ? 'sell-listings' : 'buy-requests'
  const amount = 'price' in listing ? listing.price.amount : listing.maximumPrice.amount
  const mutation = useMutation({
    mutationFn: () => kind === 'sell' ? withdrawSellListing(listing.id) : withdrawBuyRequest(listing.id),
    onSuccess: async () => { setMessage('success'); setConfirming(false); await invalidateListings(queryClient, kind, listing.id) },
    onError: async (error) => { setMessage(withdrawFailure(error)); await invalidateListings(queryClient, kind, listing.id) },
  })
  return (
    <li className="owned-row">
      <div className="owned-row__book"><strong>{listing.book.title}</strong><span>{listing.book.author}</span><span>ISBN {listing.book.isbn}</span></div>
      <span>{messages.common.condition[listing.condition]}</span>
      <span className={`listing-status listing-status--${listing.status}`}>{messages.common.listingStatus[listing.status]}</span>
      <div className="owned-row__price"><small>{kind === 'sell' ? messages.owned.salePrice : messages.owned.maximumPrice}</small><strong>{formatMoney(amount)}</strong></div>
      <div className="owned-row__actions">
        <Link to={`/${resource}/${listing.id}`}>{messages.owned.details}</Link>
        {listing.availableActions.includes('withdraw') && !confirming && <button type="button" onClick={() => setConfirming(true)}>{messages.owned.withdraw}</button>}
        {confirming && <span className="withdraw-confirm"><span>{messages.owned.confirmWithdraw}</span><button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{messages.owned.confirm}</button><button type="button" disabled={mutation.isPending} onClick={() => setConfirming(false)}>{messages.owned.cancel}</button></span>}
      </div>
      {message && <p className="owned-row__message" role={mutation.isError ? 'alert' : 'status'}>{message === 'success' ? messages.owned.withdrawn : messages.owned.errors[message]}</p>}
    </li>
  )
}

/** 渲染当前用户出售和求购挂单的账簿式列表。 */
export function MyListingsPage() {
  const { messages } = useLocale()
  const [params, setParams] = useSearchParams()
  const kind = kindFrom(params)
  const query = useInfiniteQuery({
    queryKey: ['my-listings', kind],
    queryFn: ({ pageParam }) => listMyListings(kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const listings = query.data?.pages.reduce<MarketplaceListing[]>((items, page) => {
    items.push(...page.items)
    return items
  }, []) ?? []
  useEffect(() => {
    const normalized = kind === 'buy' ? 'type=buy' : ''
    if (params.toString() !== normalized) {
      setParams(normalized, { replace: true })
    }
  }, [kind, params, setParams])
  return (
    <Page title={messages.owned.title}>
      <nav className="owned-tabs" aria-label={messages.owned.typeNavigation}>
        <button type="button" aria-current={kind === 'sell' ? 'page' : undefined} onClick={() => setParams({})}>{messages.owned.sell}</button>
        <button type="button" aria-current={kind === 'buy' ? 'page' : undefined} onClick={() => setParams({ type: 'buy' })}>{messages.owned.buy}</button>
      </nav>
      <section className="owned-ledger" aria-live="polite" aria-busy={query.isPending}>
        {query.isPending && <p className="owned-state">{messages.owned.loading}</p>}
        {query.isError && <div className="owned-state" role="alert"><p>{messages.owned.failure}</p><button type="button" onClick={() => query.refetch()}>{messages.common.reload}</button></div>}
        {query.isSuccess && listings.length === 0 && <div className="owned-state"><BookOpen aria-hidden="true" /><p>{messages.owned.empty(kind)}</p><Link to={`/publish${kind === 'buy' ? '?type=buy' : ''}`}>{messages.owned.publish}</Link></div>}
        {listings.length > 0 && <ul>{listings.map((listing) => <OwnedRow key={listing.id} kind={kind} listing={listing} />)}</ul>}
        {query.hasNextPage && <button className="load-more" type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? messages.common.loadingMore : messages.common.loadMore}</button>}
      </section>
    </Page>
  )
}
