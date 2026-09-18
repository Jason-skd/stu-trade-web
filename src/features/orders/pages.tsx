import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  confirmOrderCompletion,
  listOrders,
  type Order,
  type OrderStatus,
} from '../../api/orders.ts'
import { ApiProblem } from '../../api/problem.ts'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from '../auth/session-context.ts'
import './orders.css'

// === define order presentation ===

const statusLabels: Record<OrderStatus, string> = {
  pending_delivery: '待交付',
  completed: '已完成',
}

function statusFrom(params: URLSearchParams): OrderStatus {
  return params.get('status') === 'completed' ? 'completed' : 'pending_delivery'
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function confirmationFailure(error: unknown) {
  if (!(error instanceof ApiProblem)) return '确认服务暂时不可用，请稍后重试。'
  switch (error.problem.status) {
    case 401:
      return '登录状态已失效，请重新登录。'
    case 403:
      return '你不是这笔订单的参与者。'
    case 404:
      return '订单不存在或已被移除。'
    case 409:
      return '订单状态已经变化，列表已刷新。'
    default:
      return '确认服务暂时不可用，请稍后重试。'
  }
}

async function invalidateOrders(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['orders', 'pending_delivery'] }),
    queryClient.invalidateQueries({ queryKey: ['orders', 'completed'] }),
  ])
}

// === render order ledger row ===

function OrderRow({
  order,
  userId,
  onConflict,
}: {
  order: Order
  userId: string
  onConflict: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const isSeller = order.seller.id === userId
  const counterparty = isSeller ? order.buyer : order.seller
  const mineConfirmed = isSeller
    ? Boolean(order.sellerConfirmedCompletionAt)
    : Boolean(order.buyerConfirmedCompletionAt)
  const otherConfirmed = isSeller
    ? Boolean(order.buyerConfirmedCompletionAt)
    : Boolean(order.sellerConfirmedCompletionAt)
  const mutation = useMutation({
    mutationFn: () => confirmOrderCompletion(order.id),
    onSuccess: async () => {
      setConfirming(false)
      await invalidateOrders(queryClient)
    },
    onError: async (error) => {
      const failure = confirmationFailure(error)
      setMessage(failure)
      if (error instanceof ApiProblem && error.problem.status === 409) {
        onConflict(failure)
        await invalidateOrders(queryClient)
      }
    },
  })

  return (
    <li className="order-row">
      <div className="order-row__book">
        <strong>{order.book.title}</strong>
        <span>{order.book.author}</span>
        <span>ISBN {order.book.isbn}</span>
      </div>
      <dl className="order-row__facts">
        <div><dt>成交价格</dt><dd>{formatMoney(order.agreedPrice.amount)}</dd></div>
        <div><dt>我的角色</dt><dd>{isSeller ? '卖方' : '买方'}</dd></div>
        <div>
          <dt>交易对象</dt>
          <dd>{counterparty.nickname}<a href={`mailto:${counterparty.email}`}>{counterparty.email}</a></dd>
        </div>
      </dl>
      <div className="order-progress" aria-label="交付确认进度">
        <span className={mineConfirmed ? 'is-confirmed' : ''}>你：{mineConfirmed ? '已确认' : '待确认'}</span>
        <span className={otherConfirmed ? 'is-confirmed' : ''}>对方：{otherConfirmed ? '已确认' : '待确认'}</span>
      </div>
      <div className="order-row__state">
        <span className={`order-status order-status--${order.status}`}>
          {statusLabels[order.status]}
        </span>
        {order.status === 'pending_delivery' && mineConfirmed && (
          <p>等待对方确认</p>
        )}
        {order.status === 'completed' && <p>双方已确认交付</p>}
      </div>
      {order.status === 'pending_delivery' && !mineConfirmed && !confirming && (
        <button
          className="order-confirm-entry"
          type="button"
          onClick={() => { setMessage(''); setConfirming(true) }}
        >
          确认已完成交付
        </button>
      )}
      {confirming && (
        <div className="order-confirmation">
          <p>请在线下完成书籍与款项交接后再确认。确认后需等待对方完成确认。</p>
          <div>
            <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? '确认中…' : '确认交付完成'}
            </button>
            <button type="button" disabled={mutation.isPending} onClick={() => setConfirming(false)}>
              暂不确认
            </button>
          </div>
        </div>
      )}
      {message && <p className="order-row__message" role="alert">{message}</p>}
    </li>
  )
}

// === render orders page ===

/** 渲染当前用户可筛选和分页的订单账簿。 */
export function OrdersPage() {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useState('')
  const status = statusFrom(params)
  const query = useInfiniteQuery({
    queryKey: ['orders', status],
    queryFn: ({ pageParam }) => listOrders(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const orders = query.data?.pages.reduce<Order[]>((items, page) => {
    items.push(...page.items)
    return items
  }, []) ?? []

  const userId = session.status === 'authenticated' ? session.session.user.id : ''
  return (
    <Page title="订单">
      <nav className="order-tabs" aria-label="订单状态">
        {(['pending_delivery', 'completed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-current={status === value ? 'page' : undefined}
            onClick={() => { setNotice(''); setParams({ status: value }) }}
          >
            {statusLabels[value]}
          </button>
        ))}
      </nav>
      {notice && <p className="order-notice" role="alert">{notice}</p>}
      <section className="order-ledger" aria-live="polite" aria-busy={query.isPending}>
        {query.isPending && <p className="order-state">正在读取订单…</p>}
        {query.isError && (
          <div className="order-state" role="alert">
            <p>订单暂时无法载入。</p>
            <button type="button" onClick={() => query.refetch()}>重新加载</button>
          </div>
        )}
        {query.isSuccess && orders.length === 0 && (
          <div className="order-state">
            <BookOpen aria-hidden="true" />
            <p>还没有{statusLabels[status]}订单。</p>
            {status === 'pending_delivery' && <span>从市集完成交易后，订单会出现在这里。</span>}
          </div>
        )}
        {orders.length > 0 && (
          <ul>{orders.map((order) => <OrderRow key={order.id} order={order} userId={userId} onConflict={setNotice} />)}</ul>
        )}
        {query.hasNextPage && (
          <button
            className="order-load-more"
            type="button"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? '加载中…' : '加载更多订单'}
          </button>
        )}
      </section>
      <p className="order-footnote"><ClipboardCheck aria-hidden="true" size={18} />双方分别确认后，订单才会进入已完成。</p>
    </Page>
  )
}
