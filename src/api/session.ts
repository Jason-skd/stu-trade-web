import type { components } from './generated/schema.ts'
import { apiProblemFrom } from './problem.ts'

// === define session contracts ===

/** 当前浏览器会话。 */
export type Session = components['schemas']['Session']

/** 登录请求输入。 */
export type LoginInput = components['schemas']['LoginInput']

/** 注册请求输入。 */
export type SignupInput = components['schemas']['SignupInput']

// === submit session credentials ===

async function requestSession(path: string, body: LoginInput | SignupInput) {
  const response = await fetch(
    new URL(`/api/v1/${path}`, window.location.origin),
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json, application/problem+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) throw await apiProblemFrom(response)
  return (await response.json()) as Session
}

/** 使用邮箱和密码创建当前会话。 */
export const login = (input: LoginInput) => requestSession('login', input)

/** 注册用户并创建当前会话。 */
export const signup = (input: SignupInput) => requestSession('signup', input)

// === manage current session ===

/** 删除当前浏览器会话。 */
export async function logout() {
  const response = await fetch(
    new URL('/api/v1/sessions/current', window.location.origin),
    {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/problem+json' },
    },
  )
  if (!response.ok) throw await apiProblemFrom(response)
}

/** 恢复当前会话；未登录时返回 null。 */
export async function getCurrentSession(): Promise<Session | null> {
  const url = new URL('/api/v1/sessions/current', window.location.origin)
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json, application/problem+json' },
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw await apiProblemFrom(response)
  }

  return (await response.json()) as Session
}
