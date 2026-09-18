import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetMockSession } from '../mocks/handlers.ts'
import { server } from '../mocks/server.ts'

// === manage mock server lifecycle ===

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetMockSession()
  window.localStorage.clear()
  document.documentElement.lang = 'en'
})

afterAll(() => server.close())
