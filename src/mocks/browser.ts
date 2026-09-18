import { setupWorker } from 'msw/browser'
import { handlers } from './handlers.ts'

// === configure mock worker ===

const worker = setupWorker(...handlers)
const workerStartTimeoutMs = 3_000

// === start mock worker ===

/** 在有界等待内启动浏览器请求拦截。 */
export async function startMocking() {
  let timeoutId = 0
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error('Mock service worker startup timed out.')),
      workerStartTimeoutMs,
    )
  })

  try {
    await Promise.race([
      worker.start({ onUnhandledRequest: 'bypass' }),
      timeout,
    ])
  } finally {
    window.clearTimeout(timeoutId)
  }
}
