import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  getCurrentSession, login, logout, signup,
  type LoginInput, type SignupInput,
} from '../../api/session.ts'
import { SessionContext, type SessionContextValue } from './session-context.ts'

export type { Session } from '../../api/session.ts'

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: getCurrentSession })
  const actions = {
    login: async (input: LoginInput) => {
      const session = await login(input)
      queryClient.setQueryData(['session'], session)
      return session
    },
    signup: async (input: SignupInput) => {
      const session = await signup(input)
      queryClient.setQueryData(['session'], session)
      return session
    },
    logout: async () => {
      await logout()
      queryClient.setQueryData(['session'], null)
    },
    retry: () => { void sessionQuery.refetch() },
  }
  const state = sessionQuery.isPending
    ? { status: 'loading', session: null, error: null } as const
    : sessionQuery.isError
      ? { status: 'error', session: null, error: sessionQuery.error } as const
      : sessionQuery.data
        ? { status: 'authenticated', session: sessionQuery.data, error: null } as const
        : { status: 'anonymous', session: null, error: null } as const

  const value: SessionContextValue = { ...state, ...actions }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
