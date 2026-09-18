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
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from '../auth/session-context.ts'
import './marketplace.css'

// === define marketplace presentation ===

const conditions: Condition[] = ['new', 'like_new', 'good', 'fair', 'poor']
const conditionLabels: Record<Condition, string> = {
  new: '全新',
  like_new: '近全新',
  good: '良好',
  fair: '一般',
  poor: '较差',
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function listingPrice(listing: MarketplaceListing) {
  return 'price' in listing ? listing.price.amount : listing.maximumPrice.amount
}

function ListingCover({ listing }: { listing: MarketplaceListing }) {
  return listing.book.coverImageUrl ? (
    <img
      className="listing-cover"
      src={listing.book.coverImageUrl}
      alt={`${listing.book.title}封面`}
    />
  ) : (
    <span className="listing-cover listing-cover--empty" aria-label="暂无封面">
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
      <span className="condition-tag">{conditionLabels[listing.condition]}</span>
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
      title: '挂单不存在',
      detail: '挂单可能已删除、失效或链接有误。',
      retryable: false,
    }
  }

  return {
    title: '详情无法载入',
    detail: '服务暂时不可用，请检查网络后重试。',
    retryable: true,
  }
}

function tradeFailure(error: unknown) {
  if (!(error instanceof ApiProblem)) {
    return '成交服务暂时不可用，请稍后重试。'
  }

  switch (error.problem.status) {
    case 400:
      return '实际交付书籍信息有误，请检查后重试。'
    case 401:
      return '登录状态已失效，请重新登录。'
    case 403:
      return '你没有权限处理这条挂单。'
    case 404:
      return '挂单不存在或已被移除。'
    case 409:
      return '挂单已被处理，详情已刷新。'
    default:
      return '成交服务暂时不可用，请稍后重试。'
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
  const session = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState('')
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
    return message
      ? <p className="trade-receipt__message" role="alert">{message}</p>
      : null
  }

  // === enter authenticated trade flow ===

  function beginTrade() {
    if (session.status !== 'authenticated') {
      const target = `${location.pathname}${location.search}${location.hash}`
      navigate(`/login?returnTo=${encodeURIComponent(target)}`)
      return
    }
    setMessage('')
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
        setMessage('请完整填写 ISBN、书名和作者。')
        return
      }
      input = {
        book,
        condition: String(data.get('condition')) as Condition,
        note: String(data.get('note') ?? '').trim() || undefined,
      }
    }

    setMessage('')
    submissionLocked.current = true
    try {
      await mutation.mutateAsync(input)
      await invalidateTradeQueries(queryClient, kind, listing.id)
      navigate('/orders')
    } catch (error) {
      setMessage(tradeFailure(error))
      if (error instanceof ApiProblem && error.problem.status === 409) {
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
          ? kind === 'sell' ? '确认购买' : '接受求购'
          : kind === 'sell' ? '登录后确认购买' : '登录后接受求购'}
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
          <h3>成交凭据</h3>
          <p>确认后将立即生成订单，不能在此撤销。</p>
        </div>
      </header>
      {kind === 'buy' && (
        <fieldset>
          <legend>实际交付书籍</legend>
          <label>ISBN<input name="isbn" defaultValue={listing.book.isbn} minLength={10} required /></label>
          <label>书名<input name="title" defaultValue={listing.book.title} required /></label>
          <label>作者<input name="author" defaultValue={listing.book.author} required /></label>
          <label>成色<select name="condition" defaultValue={listing.condition}>{conditions.map((condition) => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}</select></label>
          <label className="trade-receipt__note">卖方备注<textarea name="note" rows={3} placeholder="例如笔记、破损或附件情况" /></label>
        </fieldset>
      )}
      <dl>
        <div><dt>书籍</dt><dd>{listing.book.title}</dd></div>
        <div><dt>{kind === 'sell' ? '卖方' : '买方'}</dt><dd>{counterparty}</dd></div>
        <div><dt>{kind === 'sell' ? '买方' : '卖方'}</dt><dd>你</dd></div>
        <div><dt>固定成交价</dt><dd>{formatMoney(amount)}</dd></div>
      </dl>
      {message && <p className="trade-receipt__message" role="alert">{message}</p>}
      <div className="trade-receipt__actions">
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? '正在成交…'
            : kind === 'sell' ? '确认并生成订单' : '确认书籍并接单'}
        </button>
        <button type="button" disabled={mutation.isPending} onClick={() => setExpanded(false)}>
          返回检查
        </button>
      </div>
    </form>
  )
}

// === render marketplace discovery ===

/** 渲染可筛选和分页的公开挂单市集。 */
export function MarketplacePage() {
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
    <Page title="市集">
      <nav className="marketplace-tabs" aria-label="挂单类型">
        {(['sell', 'buy'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-current={filters.kind === kind ? 'page' : undefined}
            onClick={() => updateFilters({ kind })}
          >
            {kind === 'sell' ? '在售书籍' : '求购需求'}
          </button>
        ))}
      </nav>
      <form
        className="marketplace-filters"
        role="search"
        onSubmit={submitSearch}
      >
        <label className="search-field">
          <span className="sr-only">按 ISBN 或书名搜索</span>
          <Search aria-hidden="true" size={19} />
          <input
            key={filters.query}
            name="q"
            defaultValue={filters.query}
            placeholder="输入 ISBN 或书名"
          />
        </label>
        <button type="submit">搜索</button>
        <label className="condition-field">
          <span>成色</span>
          <select
            value={filters.condition ?? ''}
            onChange={(event) =>
              updateFilters({
                condition: (event.target.value as Condition) || undefined,
              })
            }
          >
            <option value="">全部</option>
            {conditions.map((value) => (
              <option key={value} value={value}>
                {conditionLabels[value]}
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
          <Status title="正在整理书架" detail="挂单马上就来。" />
        )}
        {marketplaceQuery.isError && (
          <Status
            title="市集暂时无法载入"
            detail="请检查网络后重试。"
            action={(
              <button
                type="button"
                onClick={() => marketplaceQuery.refetch()}
              >
                重新加载
              </button>
            )}
          />
        )}
        {marketplaceQuery.isSuccess && listings.length === 0 && (
          <Status title="没有找到挂单" detail="换个关键词或成色再看看。" />
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
            {marketplaceQuery.isFetchingNextPage ? '加载中…' : '查看更多'}
          </button>
        )}
      </section>
    </Page>
  )
}

// === render marketplace detail ===

/** 渲染挂单详情及其可用状态。 */
export function MarketplaceDetailPage({ kind }: { kind: MarketplaceKind }) {
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
        <Status title="正在载入详情" detail="请稍候。" />
      </DetailFrame>
    )
  }
  if (detailQuery.isError) {
    const failure = detailFailure(detailQuery.error)
    const action = (
      <span className="status-actions">
        {failure.retryable && (
          <button type="button" onClick={() => detailQuery.refetch()}>重试</button>
        )}
        <Link to={back}>返回市集</Link>
      </span>
    )
    return (
      <DetailFrame>
        <Status title={failure.title} detail={failure.detail} action={action} />
      </DetailFrame>
    )
  }

  const listing = detailQuery.data
  const own = session.status === 'authenticated' &&
    session.session.user.id === listing.owner.id
  const state = listing.status !== 'open'
    ? '此挂单已失效'
    : own
      ? '这是你的挂单'
      : '挂单仍然有效'

  return (
    <DetailFrame>
      <div className="detail-layout">
        <Link className="detail-back" to={back}>返回市集</Link>
        <article className="listing-detail">
          <ListingCover listing={listing} />
          <div>
            <p className={`detail-kind detail-kind--${kind}`}>
              {kind === 'sell' ? '在售书籍' : '求购需求'}
            </p>
            <h2>{listing.book.title}</h2>
            <p>{listing.book.author}</p>
            <dl>
              <div>
                <dt>ISBN</dt>
                <dd>{listing.book.isbn}</dd>
              </div>
              <div>
                <dt>成色</dt>
                <dd>{conditionLabels[listing.condition]}</dd>
              </div>
              <div>
                <dt>{kind === 'sell' ? '售价' : '最高预算'}</dt>
                <dd>{formatMoney(listingPrice(listing))}</dd>
              </div>
              <div>
                <dt>发布者</dt>
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
  return (
    <div className="marketplace-detail-frame">
      <aside className="marketplace-detail-frame__list" aria-label="市集列表">
        <MarketplacePage />
      </aside>
      <div className="marketplace-detail-frame__detail">
        <Page title="挂单详情">{children}</Page>
      </div>
    </div>
  )
}
