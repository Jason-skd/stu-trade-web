import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { BookOpen, ImageOff, ReceiptText, Search } from 'lucide-react'
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  getMarketplaceListing,
  listMarketplace,
  type Condition,
  type MarketplaceKind,
  type MarketplaceListing,
} from '../../api/marketplace.ts'
import { ApiProblem } from '../../api/problem.ts'
import {
  acceptBuyRequest,
  purchaseSellListing,
  type AcceptBuyRequestInput,
} from '../../api/orders.ts'
import { useLocale } from '../../app/locale-context.ts'
import type { Messages } from '../../app/messages.ts'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from '../auth/session-context.ts'
import './marketplace.css'

// === define marketplace presentation ===

const conditions: Condition[] = ['new', 'like_new', 'good', 'fair', 'poor']

function listingPrice(listing: MarketplaceListing) {
  return 'price' in listing ? listing.price.amount : listing.maximumPrice.amount
}

function ListingCover({ listing }: { listing: MarketplaceListing }) {
  const { messages } = useLocale()
  return listing.book.coverImageUrl ? (
    <img
      className="listing-cover"
      src={listing.book.coverImageUrl}
      alt={messages.marketplace.coverAlt(listing.book.title)}
    />
  ) : (
    <span className="listing-cover listing-cover--empty" aria-label={messages.marketplace.noCover}>
      <ImageOff aria-hidden="true" size={22} />
    </span>
  )
}

function ListingRow({
  kind,
  listing,
}: {
  kind: MarketplaceKind
  listing: MarketplaceListing
}) {
  const { formatMoney, messages } = useLocale()
  const resource = kind === 'sell' ? 'sell-listings' : 'buy-requests'
  const { search } = useLocation()
  return (
    <li className="listing-row">
      <ListingCover listing={listing} />
      <div className="listing-row__book">
        <Link
          className="listing-row__title"
          to={{ pathname: `/${resource}/${listing.id}`, search }}
        >
          {listing.book.title}
        </Link>
        <span>{listing.book.author}</span>
        <span>ISBN {listing.book.isbn}</span>
      </div>
      <span className="condition-tag">{messages.common.condition[listing.condition]}</span>
      <strong className="listing-row__price">{formatMoney(listingPrice(listing))}</strong>
    </li>
  )
}

function readFilters(params: URLSearchParams) {
  const kind: MarketplaceKind = params.get('type') === 'buy' ? 'buy' : 'sell'
  const query = params.get('q')?.trim() ?? ''
  const condition = conditions.find((value) => value === params.get('condition'))
  return { kind, query, condition }
}

function Status({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  action?: ReactNode
}) {
  return (
    <div className="marketplace-status">
      <BookOpen aria-hidden="true" />
      <h2>{title}</h2>
      <p>{detail}</p>
      {action}
    </div>
  )
}

function detailFailure(error: unknown) {
  if (error instanceof ApiProblem && error.problem.code === 'not_found') {
    return {
      kind: 'missing' as const,
      retryable: false,
    }
  }

  return {
    kind: 'unavailable' as const,
    retryable: true,
  }
}

type TradeError = keyof Messages['marketplace']['trade']['errors']

function tradeFailure(error: unknown): TradeError {
  if (!(error instanceof ApiProblem)) {
    return 'unavailable'
  }

  switch (error.problem.code) {
    case 'validation_failed':
      return 'invalidBook'
    case 'unauthenticated':
      return 'unauthenticated'
    case 'forbidden':
      return 'forbidden'
    case 'not_found':
      return 'notFound'
    case 'listing_unavailable':
    case 'conflict':
      return 'conflict'
    default:
      return 'unavailable'
  }
}

async function invalidateTradeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  kind: MarketplaceKind,
  id: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
    queryClient.invalidateQueries({ queryKey: ['marketplace-detail', kind, id] }),
    queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
    queryClient.invalidateQueries({ queryKey: ['orders'] }),
  ])
}

// === manage direct trade confirmation ===

function DirectTradePanel({
  kind,
  listing,
}: {
  kind: MarketplaceKind
  listing: MarketplaceListing
}) {
  const { formatMoney, messages } = useLocale()
  const session = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<TradeError | null>(null)
  const submissionLocked = useRef(false)
  const action = kind === 'sell' ? 'purchase' : 'accept'
  const canTrade = listing.status === 'open' &&
    listing.availableActions.includes(action)
  const mutation = useMutation({
    mutationFn: (input?: AcceptBuyRequestInput) => kind === 'sell'
      ? purchaseSellListing(listing.id)
      : acceptBuyRequest(listing.id, input!),
  })

  if (!canTrade) {
    return error
      ? <p className="trade-receipt__message" role="alert">{messages.marketplace.trade.errors[error]}</p>
      : null
  }

  // === enter authenticated trade flow ===

  function beginTrade() {
    if (session.status !== 'authenticated') {
      const target = `${location.pathname}${location.search}${location.hash}`
      navigate(`/login?returnTo=${encodeURIComponent(target)}`)
      return
    }
    setError(null)
    setExpanded(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionLocked.current) return

    let input: AcceptBuyRequestInput | undefined
    if (kind === 'buy') {
      const data = new FormData(event.currentTarget)
      const book = {
        isbn: String(data.get('isbn') ?? '').trim(),
        title: String(data.get('title') ?? '').trim(),
        author: String(data.get('author') ?? '').trim(),
      }
      if (book.isbn.length < 10 || !book.title || !book.author) {
        setError('missingBook')
        return
      }
      input = {
        book,
        condition: String(data.get('condition')) as Condition,
        note: String(data.get('note') ?? '').trim() || undefined,
      }
    }

    setError(null)
    submissionLocked.current = true
    try {
      await mutation.mutateAsync(input)
      await invalidateTradeQueries(queryClient, kind, listing.id)
      navigate('/orders')
    } catch (error) {
      setError(tradeFailure(error))
      if (
        error instanceof ApiProblem &&
        (error.problem.code === 'listing_unavailable' ||
          error.problem.code === 'conflict')
      ) {
        await invalidateTradeQueries(queryClient, kind, listing.id)
      }
    } finally {
      submissionLocked.current = false
    }
  }

  if (!expanded) {
    return (
      <button className="trade-entry" type="button" onClick={beginTrade}>
        {session.status === 'authenticated'
          ? kind === 'sell' ? messages.marketplace.trade.buy : messages.marketplace.trade.accept
          : kind === 'sell' ? messages.marketplace.trade.loginToBuy : messages.marketplace.trade.loginToAccept}
      </button>
    )
  }

  const amount = listingPrice(listing)
  const counterparty = listing.owner.nickname
  return (
    <form className={`trade-receipt trade-receipt--${kind}`} onSubmit={submit}>
      <header>
        <ReceiptText aria-hidden="true" size={21} />
        <div>
          <h3>{messages.marketplace.trade.receipt}</h3>
          <p>{messages.marketplace.trade.receiptDetail}</p>
        </div>
      </header>
      {kind === 'buy' && (
        <fieldset>
          <legend>{messages.marketplace.trade.deliveredBook}</legend>
          <label>ISBN<input name="isbn" defaultValue={listing.book.isbn} minLength={10} required /></label>
          <label>{messages.marketplace.trade.title}<input name="title" defaultValue={listing.book.title} required /></label>
          <label>{messages.marketplace.trade.author}<input name="author" defaultValue={listing.book.author} required /></label>
          <label>{messages.marketplace.condition}<select name="condition" defaultValue={listing.condition}>{conditions.map((condition) => <option key={condition} value={condition}>{messages.common.condition[condition]}</option>)}</select></label>
          <label className="trade-receipt__note">{messages.marketplace.trade.sellerNote}<textarea name="note" rows={3} placeholder={messages.marketplace.trade.notePlaceholder} /></label>
        </fieldset>
      )}
      <dl>
        <div><dt>{messages.marketplace.trade.book}</dt><dd>{listing.book.title}</dd></div>
        <div><dt>{kind === 'sell' ? messages.marketplace.seller : messages.marketplace.buyer}</dt><dd>{counterparty}</dd></div>
        <div><dt>{kind === 'sell' ? messages.marketplace.buyer : messages.marketplace.seller}</dt><dd>{messages.marketplace.you}</dd></div>
        <div><dt>{messages.marketplace.trade.fixedPrice}</dt><dd>{formatMoney(amount)}</dd></div>
      </dl>
      {error && <p className="trade-receipt__message" role="alert">{messages.marketplace.trade.errors[error]}</p>}
      <div className="trade-receipt__actions">
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? messages.marketplace.trade.pending
            : kind === 'sell' ? messages.marketplace.trade.confirmOrder : messages.marketplace.trade.confirmBook}
        </button>
        <button type="button" disabled={mutation.isPending} onClick={() => setExpanded(false)}>
          {messages.marketplace.trade.review}
        </button>
      </div>
    </form>
  )
}

// === render marketplace discovery ===

/** 渲染可筛选和分页的公开挂单市集。 */
export function MarketplacePage() {
  const { messages } = useLocale()
  // === load marketplace listings ===

  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const marketplaceQuery = useInfiniteQuery({
    queryKey: ['marketplace', filters],
    queryFn: ({ pageParam }) => listMarketplace(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const listings = marketplaceQuery.data?.pages.reduce<MarketplaceListing[]>(
    (items, page) => {
      items.push(...page.items)
      return items
    },
    [],
  ) ?? []

  // === normalize marketplace filters ===

  useEffect(() => {
    const normalized = new URLSearchParams()
    if (filters.kind === 'buy') normalized.set('type', 'buy')
    if (filters.query) normalized.set('q', filters.query)
    if (filters.condition) normalized.set('condition', filters.condition)
    if (normalized.toString() !== params.toString()) {
      setParams(normalized, { replace: true })
    }
  }, [filters.condition, filters.kind, filters.query, params, setParams])

  function updateFilters(
    next: Partial<{
      kind: MarketplaceKind
      query: string
      condition?: Condition
    }>,
  ) {
    const value = { ...filters, ...next }
    const updated = new URLSearchParams()
    if (value.kind === 'buy') updated.set('type', 'buy')
    if (value.query) updated.set('q', value.query)
    if (value.condition) updated.set('condition', value.condition)
    setParams(updated)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    updateFilters({ query: String(data.get('q') ?? '').trim() })
  }

  // === render marketplace results ===

  return (
    <Page title={messages.marketplace.title}>
      <nav className="marketplace-tabs" aria-label={messages.marketplace.listingType}>
        {(['sell', 'buy'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-current={filters.kind === kind ? 'page' : undefined}
            onClick={() => updateFilters({ kind })}
          >
            {kind === 'sell' ? messages.marketplace.sellListings : messages.marketplace.buyRequests}
          </button>
        ))}
      </nav>
      <form
        className="marketplace-filters"
        role="search"
        onSubmit={submitSearch}
      >
        <label className="search-field">
          <span className="sr-only">{messages.marketplace.searchLabel}</span>
          <Search aria-hidden="true" size={19} />
          <input
            key={filters.query}
            name="q"
            defaultValue={filters.query}
            placeholder={messages.marketplace.searchPlaceholder}
          />
        </label>
        <button type="submit">{messages.marketplace.search}</button>
        <label className="condition-field">
          <span>{messages.marketplace.condition}</span>
          <select
            value={filters.condition ?? ''}
            onChange={(event) =>
              updateFilters({
                condition: (event.target.value as Condition) || undefined,
              })
            }
          >
            <option value="">{messages.marketplace.allConditions}</option>
            {conditions.map((value) => (
              <option key={value} value={value}>
                {messages.common.condition[value]}
              </option>
            ))}
          </select>
        </label>
      </form>
      <section
        className="marketplace-results"
        aria-live="polite"
        aria-busy={marketplaceQuery.isPending}
      >
        {marketplaceQuery.isPending && (
          <Status title={messages.marketplace.loadingTitle} detail={messages.marketplace.loadingDetail} />
        )}
        {marketplaceQuery.isError && (
          <Status
            title={messages.marketplace.failureTitle}
            detail={messages.marketplace.failureDetail}
            action={(
              <button
                type="button"
                onClick={() => marketplaceQuery.refetch()}
              >
                {messages.common.reload}
              </button>
            )}
          />
        )}
        {marketplaceQuery.isSuccess && listings.length === 0 && (
          <Status title={messages.marketplace.emptyTitle} detail={messages.marketplace.emptyDetail} />
        )}
        {listings.length > 0 && (
          <ul className="listing-list">
            {listings.map((listing) => (
              <ListingRow
                key={listing.id}
                kind={filters.kind}
                listing={listing}
              />
            ))}
          </ul>
        )}
        {marketplaceQuery.hasNextPage && (
          <button
            className="load-more"
            type="button"
            disabled={marketplaceQuery.isFetchingNextPage}
            onClick={() => marketplaceQuery.fetchNextPage()}
          >
            {marketplaceQuery.isFetchingNextPage ? messages.common.loadingMore : messages.marketplace.loadMore}
          </button>
        )}
      </section>
    </Page>
  )
}

// === render marketplace detail ===

/** 渲染挂单详情及其可用状态。 */
export function MarketplaceDetailPage({ kind }: { kind: MarketplaceKind }) {
  const { formatMoney, messages } = useLocale()
  const { listingId = '' } = useParams()
  const { search } = useLocation()
  const session = useSession()
  const detailQuery = useQuery({
    queryKey: ['marketplace-detail', kind, listingId],
    queryFn: () => getMarketplaceListing(kind, listingId),
  })
  const back = { pathname: '/', search }
  if (detailQuery.isPending) {
    return (
      <DetailFrame>
        <Status title={messages.marketplace.detailLoadingTitle} detail={messages.marketplace.detailLoadingDetail} />
      </DetailFrame>
    )
  }
  if (detailQuery.isError) {
    const failure = detailFailure(detailQuery.error)
    const title = failure.kind === 'missing'
      ? messages.marketplace.detailMissingTitle
      : messages.marketplace.detailFailureTitle
    const detail = failure.kind === 'missing'
      ? messages.marketplace.detailMissingDetail
      : messages.marketplace.detailFailureDetail
    const action = (
      <span className="status-actions">
        {failure.retryable && (
          <button type="button" onClick={() => detailQuery.refetch()}>{messages.common.retry}</button>
        )}
        <Link to={back}>{messages.marketplace.back}</Link>
      </span>
    )
    return (
      <DetailFrame>
        <Status title={title} detail={detail} action={action} />
      </DetailFrame>
    )
  }

  const listing = detailQuery.data
  const own = session.status === 'authenticated' &&
    session.session.user.id === listing.owner.id
  const state = listing.status !== 'open'
    ? messages.marketplace.inactive
    : own
      ? messages.marketplace.owned
      : messages.marketplace.active

  return (
    <DetailFrame>
      <div className="detail-layout">
        <Link className="detail-back" to={back}>{messages.marketplace.back}</Link>
        <article className="listing-detail">
          <ListingCover listing={listing} />
          <div>
            <p className={`detail-kind detail-kind--${kind}`}>
              {kind === 'sell' ? messages.marketplace.sellListings : messages.marketplace.buyRequests}
            </p>
            <h2>{listing.book.title}</h2>
            <p>{listing.book.author}</p>
            <dl>
              <div>
                <dt>ISBN</dt>
                <dd>{listing.book.isbn}</dd>
              </div>
              <div>
                <dt>{messages.marketplace.condition}</dt>
                <dd>{messages.common.condition[listing.condition]}</dd>
              </div>
              <div>
                <dt>{kind === 'sell' ? messages.marketplace.price : messages.marketplace.maximumPrice}</dt>
                <dd>{formatMoney(listingPrice(listing))}</dd>
              </div>
              <div>
                <dt>{messages.marketplace.publisher}</dt>
                <dd>{listing.owner.nickname}</dd>
              </div>
            </dl>
            {listing.note && <p className="detail-note">{listing.note}</p>}
            <p className={`detail-state detail-state--${listing.status}`}>
              {state}
            </p>
          </div>
          {!own && <DirectTradePanel kind={kind} listing={listing} />}
        </article>
      </div>
    </DetailFrame>
  )
}

// === frame marketplace detail ===

function DetailFrame({ children }: { children: ReactNode }) {
  const { messages } = useLocale()
  return (
    <div className="marketplace-detail-frame">
      <aside className="marketplace-detail-frame__list" aria-label={messages.marketplace.list}>
        <MarketplacePage />
      </aside>
      <div className="marketplace-detail-frame__detail">
        <Page title={messages.marketplace.detailTitle}>{children}</Page>
      </div>
    </div>
  )
}
