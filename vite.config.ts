import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// === configure web tooling ===

/** 配置 Vite 开发代理、生产构建和 Vitest 环境。 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://127.0.0.1:8080',
        },
      },
    },
    test: {
      environment: 'jsdom',
      hookTimeout: 5_000,
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 5_000,
    },
  }
})
