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
import { useLocale } from '../../app/locale-context.ts'
import type { Messages } from '../../app/messages.ts'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from '../auth/session-context.ts'
import './orders.css'

// === define order presentation ===

function statusFrom(params: URLSearchParams): OrderStatus {
  return params.get('status') === 'completed' ? 'completed' : 'pending_delivery'
}

type ConfirmationError = keyof Messages['orders']['errors']

function confirmationFailure(error: unknown): ConfirmationError {
  if (!(error instanceof ApiProblem)) return 'unavailable'
  switch (error.problem.status) {
    case 401:
      return 'unauthenticated'
    case 403:
      return 'forbidden'
    case 404:
      return 'notFound'
    case 409:
      return 'conflict'
    default:
      return 'unavailable'
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
  onConflict: (error: ConfirmationError) => void
}) {
  const { formatMoney, messages } = useLocale()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<ConfirmationError | null>(null)
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
      setError(failure)
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
        <div><dt>{messages.orders.price}</dt><dd>{formatMoney(order.agreedPrice.amount)}</dd></div>
        <div><dt>{messages.orders.role}</dt><dd>{isSeller ? messages.orders.seller : messages.orders.buyer}</dd></div>
        <div>
          <dt>{messages.orders.counterparty}</dt>
          <dd>{counterparty.nickname}<a href={`mailto:${counterparty.email}`}>{counterparty.email}</a></dd>
        </div>
      </dl>
      <div className="order-progress" aria-label={messages.orders.progress}>
        <span className={mineConfirmed ? 'is-confirmed' : ''}>{messages.orders.me}: {mineConfirmed ? messages.orders.confirmed : messages.orders.awaitingConfirmation}</span>
        <span className={otherConfirmed ? 'is-confirmed' : ''}>{messages.orders.other}: {otherConfirmed ? messages.orders.confirmed : messages.orders.awaitingConfirmation}</span>
      </div>
      <div className="order-row__state">
        <span className={`order-status order-status--${order.status}`}>
          {messages.common.orderStatus[order.status]}
        </span>
        {order.status === 'pending_delivery' && mineConfirmed && (
          <p>{messages.orders.waitingForOther}</p>
        )}
        {order.status === 'completed' && <p>{messages.orders.bothConfirmed}</p>}
      </div>
      {order.status === 'pending_delivery' && !mineConfirmed && !confirming && (
        <button
          className="order-confirm-entry"
          type="button"
          onClick={() => { setError(null); setConfirming(true) }}
        >
          {messages.orders.confirmEntry}
        </button>
      )}
      {confirming && (
        <div className="order-confirmation">
          <p>{messages.orders.confirmationDetail}</p>
          <div>
            <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? messages.orders.confirming : messages.orders.confirm}
            </button>
            <button type="button" disabled={mutation.isPending} onClick={() => setConfirming(false)}>
              {messages.orders.cancel}
            </button>
          </div>
        </div>
      )}
      {error && <p className="order-row__message" role="alert">{messages.orders.errors[error]}</p>}
    </li>
  )
}

// === render orders page ===

/** 渲染当前用户可筛选和分页的订单账簿。 */
export function OrdersPage() {
  const { messages } = useLocale()
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useState<ConfirmationError | null>(null)
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
    <Page title={messages.orders.title}>
      <nav className="order-tabs" aria-label={messages.orders.statusNavigation}>
        {(['pending_delivery', 'completed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-current={status === value ? 'page' : undefined}
            onClick={() => { setNotice(null); setParams({ status: value }) }}
          >
            {messages.common.orderStatus[value]}
          </button>
        ))}
      </nav>
      {notice && <p className="order-notice" role="alert">{messages.orders.errors[notice]}</p>}
      <section className="order-ledger" aria-live="polite" aria-busy={query.isPending}>
        {query.isPending && <p className="order-state">{messages.orders.loading}</p>}
        {query.isError && (
          <div className="order-state" role="alert">
            <p>{messages.orders.failure}</p>
            <button type="button" onClick={() => query.refetch()}>{messages.common.reload}</button>
          </div>
        )}
        {query.isSuccess && orders.length === 0 && (
          <div className="order-state">
            <BookOpen aria-hidden="true" />
            <p>{messages.orders.empty(status)}</p>
            {status === 'pending_delivery' && <span>{messages.orders.pendingEmptyDetail}</span>}
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
            {query.isFetchingNextPage ? messages.common.loadingMore : messages.orders.loadMore}
          </button>
        )}
      </section>
      <p className="order-footnote"><ClipboardCheck aria-hidden="true" size={18} />{messages.orders.footnote}</p>
    </Page>
  )
}
