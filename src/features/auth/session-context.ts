import { createContext, useContext } from 'react'
import type { LoginInput, Session, SignupInput } from '../../api/session.ts'

// === define session context ===

type SessionActions = {
  login: (input: LoginInput) => Promise<Session>
  signup: (input: SignupInput) => Promise<Session>
  logout: () => Promise<void>
  retry: () => void
}

/** 会话 Provider 对调用方公开的完整状态联合。 */
export type SessionContextValue = SessionActions & (
  | { status: 'loading'; session: null; error: null }
  | { status: 'anonymous'; session: null; error: null }
  | { status: 'authenticated'; session: Session; error: null }
  | { status: 'error'; session: null; error: Error })

/** 会话状态的 React 上下文。 */
export const SessionContext = createContext<SessionContextValue | null>(null)

// === access current session ===

/** 读取当前会话状态和身份操作。 */
export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }

  return context
}
