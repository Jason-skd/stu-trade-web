import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './session-context.ts'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (session.status === 'loading') return <p role="status">正在恢复会话…</p>
  if (session.status === 'error') return <div role="alert">暂时无法确认登录状态。<button onClick={session.retry}>重试</button></div>
  if (session.status === 'anonymous') {
    const target = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(target)}`} />
  }
  return children
}
