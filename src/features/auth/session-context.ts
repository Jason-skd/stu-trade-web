import { createContext, useContext } from 'react'
import type { LoginInput, Session, SignupInput } from '../../api/session.ts'

type SessionActions = {
  login: (input: LoginInput) => Promise<Session>
  signup: (input: SignupInput) => Promise<Session>
  logout: () => Promise<void>
  retry: () => void
}

export type SessionContextValue = SessionActions & (
  | { status: 'loading'; session: null; error: null }
  | { status: 'anonymous'; session: null; error: null }
  | { status: 'authenticated'; session: Session; error: null }
  | { status: 'error'; session: null; error: Error })

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }

  return context
}
