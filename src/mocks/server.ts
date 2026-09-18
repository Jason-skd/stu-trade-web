import { setupServer } from 'msw/node'
import { handlers } from './handlers.ts'

// === create mock server ===

/** 为组件测试创建共享的 Node 请求拦截服务器。 */
export const server = setupServer(...handlers)
