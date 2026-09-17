import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import './styles/tokens.css'
import './styles/global.css'

if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW !== 'false') {
  try {
    const { startMocking } = await import('./mocks/browser.ts')
    await startMocking()
  } catch (error) {
    console.error('Failed to start the mock service worker.', error)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
