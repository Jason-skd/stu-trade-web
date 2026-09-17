import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { BookOpen, ImageOff, Search } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  getMarketplaceListing,
  listMarketplace,
  type Condition,
  type MarketplaceKind,
  type MarketplaceListing,
} from '../../api/marketplace.ts'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from '../auth/session-context.ts'
import './marketplace.css'

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
    <img className="listing-cover" src={listing.book.coverImageUrl} alt={`${listing.book.title}封面`} />
  ) : (
    <span className="listing-cover listing-cover--empty" aria-label="暂无封面">
      <ImageOff aria-hidden="true" size={22} />
    </span>
  )
}

function ListingRow({ kind, listing }: { kind: MarketplaceKind; listing: MarketplaceListing }) {
  const resource = kind === 'sell' ? 'sell-listings' : 'buy-requests'
  return (
    <li className="listing-row">
      <ListingCover listing={listing} />
      <div className="listing-row__book">
        <Link className="listing-row__title" to={`/${resource}/${listing.id}`}>{listing.book.title}</Link>
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

function Status({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="marketplace-status"><BookOpen aria-hidden="true" /><h2>{title}</h2><p>{detail}</p>{action}</div>
}

export function MarketplacePage() {
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const marketplaceQuery = useInfiniteQuery({
    queryKey: ['marketplace', filters],
    queryFn: ({ pageParam }) => listMarketplace(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const listings: MarketplaceListing[] =
    marketplaceQuery.data?.pages.flatMap((page) =>
      page.items.map((listing) => listing as MarketplaceListing),
    ) ?? []

  useEffect(() => {
    const normalized = new URLSearchParams()
    if (filters.kind === 'buy') normalized.set('type', 'buy')
    if (filters.query) normalized.set('q', filters.query)
    if (filters.condition) normalized.set('condition', filters.condition)
    if (normalized.toString() !== params.toString()) {
      setParams(normalized, { replace: true })
    }
  }, [filters.condition, filters.kind, filters.query, params, setParams])

  function updateFilters(next: Partial<{ kind: MarketplaceKind; query: string; condition?: Condition }>) {
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

  return <Page title="市集">
    <nav className="marketplace-tabs" aria-label="挂单类型">
      {(['sell', 'buy'] as const).map((kind) => <button key={kind} type="button" aria-current={filters.kind === kind ? 'page' : undefined} onClick={() => updateFilters({ kind })}>{kind === 'sell' ? '在售书籍' : '求购需求'}</button>)}
    </nav>
    <form className="marketplace-filters" role="search" onSubmit={submitSearch}>
      <label className="search-field"><span className="sr-only">按 ISBN 或书名搜索</span><Search aria-hidden="true" size={19} /><input key={filters.query} name="q" defaultValue={filters.query} placeholder="输入 ISBN 或书名" /></label>
      <button type="submit">搜索</button>
      <label className="condition-field"><span>成色</span><select value={filters.condition ?? ''} onChange={(event) => updateFilters({ condition: (event.target.value as Condition) || undefined })}><option value="">全部</option>{conditions.map((value) => <option key={value} value={value}>{conditionLabels[value]}</option>)}</select></label>
    </form>
    <section className="marketplace-results" aria-live="polite" aria-busy={marketplaceQuery.isPending}>
      {marketplaceQuery.isPending && <Status title="正在整理书架" detail="挂单马上就来。" />}
      {marketplaceQuery.isError && <Status title="市集暂时无法载入" detail="请检查网络后重试。" action={<button type="button" onClick={() => marketplaceQuery.refetch()}>重新加载</button>} />}
      {marketplaceQuery.isSuccess && listings.length === 0 && <Status title="没有找到挂单" detail="换个关键词或成色再看看。" />}
      {listings.length > 0 && <ul className="listing-list">{listings.map((listing) => <ListingRow key={listing.id} kind={filters.kind} listing={listing} />)}</ul>}
      {marketplaceQuery.hasNextPage && <button className="load-more" type="button" disabled={marketplaceQuery.isFetchingNextPage} onClick={() => marketplaceQuery.fetchNextPage()}>{marketplaceQuery.isFetchingNextPage ? '加载中…' : '查看更多'}</button>}
    </section>
  </Page>
}

export function MarketplaceDetailPage({ kind }: { kind: MarketplaceKind }) {
  const { listingId = '' } = useParams()
  const session = useSession()
  const detailQuery = useQuery({ queryKey: ['marketplace-detail', kind, listingId], queryFn: () => getMarketplaceListing(kind, listingId) })
  const back = kind === 'buy' ? '/?type=buy' : '/'
  if (detailQuery.isPending) return <DetailFrame><Status title="正在载入详情" detail="请稍候。" /></DetailFrame>
  if (detailQuery.isError) return <DetailFrame><Status title="详情无法载入" detail="挂单可能已删除，或网络暂时不可用。" action={<span className="status-actions"><button type="button" onClick={() => detailQuery.refetch()}>重试</button><Link to={back}>返回市集</Link></span>} /></DetailFrame>
  const listing = detailQuery.data
  const own = session.status === 'authenticated' && session.session.user.id === listing.owner.id
  const state = listing.status !== 'open' ? '此挂单已失效' : own ? '这是你的挂单' : '挂单仍然有效'
  return <DetailFrame kind={kind}><div className="detail-layout"><Link className="detail-back" to={back}>返回市集</Link><article className="listing-detail"><ListingCover listing={listing} /><div><p className={`detail-kind detail-kind--${kind}`}>{kind === 'sell' ? '在售书籍' : '求购需求'}</p><h2>{listing.book.title}</h2><p>{listing.book.author}</p><dl><div><dt>ISBN</dt><dd>{listing.book.isbn}</dd></div><div><dt>成色</dt><dd>{conditionLabels[listing.condition]}</dd></div><div><dt>{kind === 'sell' ? '售价' : '最高预算'}</dt><dd>{formatMoney(listingPrice(listing))}</dd></div><div><dt>发布者</dt><dd>{listing.owner.nickname}</dd></div></dl>{listing.note && <p className="detail-note">{listing.note}</p>}<p className={`detail-state detail-state--${listing.status}`}>{state}</p>{listing.status === 'open' && !own && <p className="detail-guidance">登录后可在后续交易流程中处理此挂单。</p>}</div></article></div></DetailFrame>
}

function DetailFrame({ children }: { children: ReactNode; kind?: MarketplaceKind }) {
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

export function PublishPage() {
  return <Page title="发布" />
}

export function ProfilePage() {
  const session = useSession()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState(false)
  async function handleLogout() {
    setLogoutError(false)
    try { await session.logout(); navigate('/') } catch { setLogoutError(true) }
  }
  return <Page title="我的">
    {session.status === 'authenticated' && <>
      <p className="page__prompt">{session.session.user.nickname}</p>
      {logoutError && <p role="alert">退出失败，请稍后重试。</p>}
      <button onClick={handleLogout}>退出登录</button>
    </>}
  </Page>
}
