import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { SessionProvider } from '../features/auth/session.tsx'
import { createQueryClient } from './query-client.ts'

type AppProvidersProps = {
  children: ReactNode
  queryClient?: QueryClient
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [defaultQueryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient ?? defaultQueryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  )
}
