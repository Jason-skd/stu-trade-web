import { QueryClient } from '@tanstack/react-query'

// === create query client ===

/** 创建采用 StuTrade 默认请求策略的查询客户端。 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 60_000,
      },
    },
  })
}
