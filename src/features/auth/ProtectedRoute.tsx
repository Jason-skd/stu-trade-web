import { Navigate, useLocation } from 'react-router-dom'
import { useLocale } from '../../app/locale-context.ts'
import { useSession } from './session-context.ts'

// === protect authenticated route ===

/** 恢复会话后允许访问受保护内容，否则引导用户登录。 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const { messages } = useLocale()
  const location = useLocation()
  if (session.status === 'loading') return <p role="status">{messages.auth.restoring}</p>
  if (session.status === 'error') {
    return (
      <div role="alert">
        {messages.auth.restoreFailure}
        <button type="button" onClick={session.retry}>{messages.common.retry}</button>
      </div>
    )
  }
  if (session.status === 'anonymous') {
    const target = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(target)}`} />
  }
  return children
}
