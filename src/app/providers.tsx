import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { SessionProvider } from '../features/auth/session.tsx'
import { createQueryClient } from './query-client.ts'

// === define provider inputs ===

type AppProvidersProps = {
  children: ReactNode
  queryClient?: QueryClient
}

// === assemble application providers ===

/** 装配查询缓存和当前会话上下文。 */
export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [defaultQueryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient ?? defaultQueryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  )
}
