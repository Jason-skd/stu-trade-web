import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { components } from '../../api/generated/schema.ts'
import { AppProviders } from '../../app/providers.tsx'
import { appRoutes } from '../../app/routes.tsx'
import { server } from '../../mocks/server.ts'

const session = { user: { id: 'user-1', nickname: '林同学', email: 'lin@example.edu' } } satisfies components['schemas']['Session']
const problem = (code: components['schemas']['Problem']['code'], status: number) => ({
  type: `/problems/${code}`, title: 'Request failed', status, code, detail: 'Internal detail',
}) satisfies components['schemas']['Problem']

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<AppProviders queryClient={queryClient}><RouterProvider router={router} /></AppProviders>)
  return router
}

describe('authentication', () => {
  it('logs in once and returns to the protected target', async () => {
    const loginRequest = vi.fn()
    let completeLogin: (() => void) | undefined
    const loginPending = new Promise<void>((resolve) => { completeLogin = resolve })
    server.use(http.post('*/api/v1/login', async ({ request }) => {
      loginRequest(await request.json())
      await loginPending
      return HttpResponse.json(session)
    }))
    const router = renderRoute('/orders?filter=open#latest')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('邮箱'), 'lin@example.edu')
    await user.type(screen.getByLabelText('密码'), 'secret123')
    const submission = user.dblClick(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(loginRequest).toHaveBeenCalledTimes(1))
    completeLogin?.()
    await submission
    expect(await screen.findByRole('heading', { name: '订单' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/orders')
    expect(router.state.location.search).toBe('?filter=open')
    expect(router.state.location.hash).toBe('#latest')
    expect(loginRequest).toHaveBeenCalledTimes(1)
    expect(loginRequest).toHaveBeenCalledWith({ email: 'lin@example.edu', password: 'secret123' })
  })

  it('registers and maps an occupied email to stable user language', async () => {
    server.use(http.post('*/api/v1/signup', () => HttpResponse.json(problem('email_taken', 409), { status: 409 })))
    renderRoute('/signup')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('邮箱'), 'used@example.edu')
    await user.type(screen.getByLabelText('昵称'), '新同学')
    await user.type(screen.getByLabelText('密码'), 'secret123')
    await user.click(screen.getByRole('button', { name: '注册并登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('该邮箱已注册，请直接登录。')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Internal detail')
  })

  it('rejects an external return target', async () => {
    server.use(http.post('*/api/v1/login', () => HttpResponse.json(session)))
    const router = renderRoute('/login?returnTo=//evil.example')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('邮箱'), 'lin@example.edu')
    await user.type(screen.getByLabelText('密码'), 'secret123')
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('heading', { name: '市集' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows restoration failure and retries into an authenticated page', async () => {
    let attempts = 0
    server.use(http.get('*/api/v1/sessions/current', () => { attempts += 1; return attempts === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(session) }))
    renderRoute('/me')
    const user = userEvent.setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法确认登录状态')
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('林同学', { selector: 'p' })).toBeInTheDocument()
  })

  it('logs out and clears the local identity', async () => {
    server.use(http.get('*/api/v1/sessions/current', () => HttpResponse.json(session)), http.delete('*/api/v1/sessions/current', () => new HttpResponse(null, { status: 204 })))
    renderRoute('/me')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '退出登录' }))
    expect(await screen.findByRole('heading', { name: '市集' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute('href', '/login')
  })
})
