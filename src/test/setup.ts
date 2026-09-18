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
})

afterAll(() => server.close())
