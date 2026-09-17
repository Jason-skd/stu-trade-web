import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './providers.tsx'
import { createAppRouter } from './routes.tsx'

const router = createAppRouter()

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
