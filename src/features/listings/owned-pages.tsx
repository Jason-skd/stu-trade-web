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
import { Page } from '../../shared/components/Page.tsx'
import './owned-listings.css'

// === define owned listing presentation ===

const conditions: Condition[] = ['new', 'like_new', 'good', 'fair', 'poor']
const conditionLabels: Record<Condition, string> = {
  new: '全新', like_new: '近全新', good: '良好', fair: '一般', poor: '较差',
}
const statusLabels = {
  open: '有效', reserved: '已撮合', matched: '已成交', withdrawn: '已停用',
} as const

function kindFrom(params: URLSearchParams): MarketplaceKind {
  return params.get('type') === 'buy' ? 'buy' : 'sell'
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency', currency: 'CNY', minimumFractionDigits: 2,
  }).format(amount / 100)
}

function parseAmount(value: string) {
  const normalized = value.trim()
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null
  const [yuan, fraction = ''] = normalized.split('.')
  const amount = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

class FieldError extends Error {}

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
  const [params, setParams] = useSearchParams()
  const kind = kindFrom(params)
  const [price, setPrice] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [serviceError, setServiceError] = useState('')
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
      if (book.isbn.length < 10) throw new FieldError('请输入至少 10 位 ISBN。')
      if (!book.title) throw new FieldError('请输入书名。')
      if (!book.author) throw new FieldError('请输入作者。')
      if (amount === null) throw new FieldError('请输入大于 0 且最多两位小数的金额。')
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
    setFieldError('')
    setServiceError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    setFieldError('')
    setServiceError('')
    submitting.current = true
    try {
      await mutation.mutateAsync({ form: event.currentTarget, submittedKind: kind })
    } catch (error) {
      if (error instanceof FieldError) setFieldError(error.message)
      else setServiceError('发布失败，请稍后重试。')
    } finally {
      submitting.current = false
    }
  }

  if (created) {
    const resource = created.kind === 'sell' ? 'sell-listings' : 'buy-requests'
    return (
      <Page title="发布成功">
        <section className={`publish-success publish-success--${created.kind}`} aria-live="polite">
          <BookCheck aria-hidden="true" />
          <h2>{created.kind === 'sell' ? '出售挂单已发布' : '求购需求已发布'}</h2>
          <p>{created.listing.book.title} 已登记，可以立即查看详情。</p>
          <div className="publish-success__actions">
            <Link to={`/${resource}/${created.listing.id}`}>查看挂单</Link>
            <button type="button" onClick={() => { setCreated(null); setPrice('') }}>继续发布</button>
          </div>
        </section>
      </Page>
    )
  }

  return (
    <Page title="发布">
      <nav className="owned-tabs" aria-label="发布类型">
        <button type="button" disabled={mutation.isPending} aria-current={kind === 'sell' ? 'page' : undefined} onClick={() => switchKind('sell')}>出售书籍</button>
        <button type="button" disabled={mutation.isPending} aria-current={kind === 'buy' ? 'page' : undefined} onClick={() => switchKind('buy')}>发布求购</button>
      </nav>
      <form className={`publish-form publish-form--${kind}`} noValidate onSubmit={submit}>
        <fieldset>
          <legend>书籍信息</legend>
          <label>ISBN<input name="isbn" required minLength={10} /></label>
          <label>书名<input name="title" required /></label>
          <label>作者<input name="author" required /></label>
        </fieldset>
        <fieldset>
          <legend>成色与备注</legend>
          <label>成色<select name="condition" defaultValue="good">{conditions.map((value) => <option key={value} value={value}>{conditionLabels[value]}</option>)}</select></label>
          <label>备注<textarea name="note" rows={4} /></label>
        </fieldset>
        <fieldset>
          <legend>价格</legend>
          <label>{kind === 'sell' ? '出售价格（元）' : '最高预算（元）'}<input inputMode="decimal" name="price" value={price} onChange={(event) => setPrice(event.target.value)} aria-describedby="price-guidance" /></label>
          <small id="price-guidance">请输入大于 0 的金额，最多保留两位小数。</small>
        </fieldset>
        {fieldError && <p className="form-message" role="alert">{fieldError}</p>}
        {serviceError && <p className="form-message" role="alert">{serviceError}</p>}
        <button className="publish-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? '发布中…' : kind === 'sell' ? '发布出售' : '发布求购'}</button>
      </form>
    </Page>
  )
}

// === manage owned listings ===

function withdrawFailure(error: unknown) {
  if (error instanceof ApiProblem && error.problem.status === 403) return '无法停用：你不是这条挂单的发布者。'
  if (error instanceof ApiProblem && error.problem.status === 409) return '挂单状态已经变化，列表已刷新。'
  return '停用失败，请稍后重试。'
}

function OwnedRow({ kind, listing }: { kind: MarketplaceKind; listing: MarketplaceListing }) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()
  const resource = kind === 'sell' ? 'sell-listings' : 'buy-requests'
  const amount = 'price' in listing ? listing.price.amount : listing.maximumPrice.amount
  const mutation = useMutation({
    mutationFn: () => kind === 'sell' ? withdrawSellListing(listing.id) : withdrawBuyRequest(listing.id),
    onSuccess: async () => { setMessage('发布已停用。'); setConfirming(false); await invalidateListings(queryClient, kind, listing.id) },
    onError: async (error) => { setMessage(withdrawFailure(error)); await invalidateListings(queryClient, kind, listing.id) },
  })
  return (
    <li className="owned-row">
      <div className="owned-row__book"><strong>{listing.book.title}</strong><span>{listing.book.author}</span><span>ISBN {listing.book.isbn}</span></div>
      <span>{conditionLabels[listing.condition]}</span>
      <span className={`listing-status listing-status--${listing.status}`}>{statusLabels[listing.status]}</span>
      <div className="owned-row__price"><small>{kind === 'sell' ? '售价' : '最高预算'}</small><strong>{formatMoney(amount)}</strong></div>
      <div className="owned-row__actions">
        <Link to={`/${resource}/${listing.id}`}>详情</Link>
        {listing.availableActions.includes('withdraw') && !confirming && <button type="button" onClick={() => setConfirming(true)}>停用发布</button>}
        {confirming && <span className="withdraw-confirm"><span>确认停用？</span><button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>确认</button><button type="button" disabled={mutation.isPending} onClick={() => setConfirming(false)}>取消</button></span>}
      </div>
      {message && <p className="owned-row__message" role={mutation.isError ? 'alert' : 'status'}>{message}</p>}
    </li>
  )
}

/** 渲染当前用户出售和求购挂单的账簿式列表。 */
export function MyListingsPage() {
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
    <Page title="我的发布">
      <nav className="owned-tabs" aria-label="我的发布类型">
        <button type="button" aria-current={kind === 'sell' ? 'page' : undefined} onClick={() => setParams({})}>出售</button>
        <button type="button" aria-current={kind === 'buy' ? 'page' : undefined} onClick={() => setParams({ type: 'buy' })}>求购</button>
      </nav>
      <section className="owned-ledger" aria-live="polite" aria-busy={query.isPending}>
        {query.isPending && <p className="owned-state">正在读取发布记录…</p>}
        {query.isError && <div className="owned-state" role="alert"><p>发布记录暂时无法载入。</p><button type="button" onClick={() => query.refetch()}>重新加载</button></div>}
        {query.isSuccess && listings.length === 0 && <div className="owned-state"><BookOpen aria-hidden="true" /><p>还没有{kind === 'sell' ? '出售挂单' : '求购需求'}。</p><Link to={`/publish${kind === 'buy' ? '?type=buy' : ''}`}>去发布</Link></div>}
        {listings.length > 0 && <ul>{listings.map((listing) => <OwnedRow key={listing.id} kind={kind} listing={listing} />)}</ul>}
        {query.hasNextPage && <button className="load-more" type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? '加载中…' : '加载更多'}</button>}
      </section>
    </Page>
  )
}
