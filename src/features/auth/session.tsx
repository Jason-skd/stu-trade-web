import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getCurrentSession } from '../../api/session.ts'
import {
  SessionContext,
  type SessionContextValue,
} from './session-context.ts'

export type { Session } from '../../api/session.ts'

export function SessionProvider({ children }: { children: ReactNode }) {
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getCurrentSession,
  })

  let value: SessionContextValue

  if (sessionQuery.isPending) {
    value = { status: 'loading', session: null, error: null }
  } else if (sessionQuery.isError) {
    value = { status: 'error', session: null, error: sessionQuery.error }
  } else if (sessionQuery.data) {
    value = {
      status: 'authenticated',
      session: sessionQuery.data,
      error: null,
    }
  } else {
    value = { status: 'anonymous', session: null, error: null }
  }

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}
