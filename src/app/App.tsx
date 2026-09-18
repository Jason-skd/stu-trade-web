import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './providers.tsx'
import { createAppRouter } from './routes.tsx'

// === assemble application root ===

const router = createAppRouter()

/** 装配全局 Provider 和浏览器路由。 */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
