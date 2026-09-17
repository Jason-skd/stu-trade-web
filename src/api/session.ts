import type { components } from './generated/schema.ts'

export type Session = components['schemas']['Session']
export type LoginInput = components['schemas']['LoginInput']
export type SignupInput = components['schemas']['SignupInput']
export type Problem = components['schemas']['Problem']

export class ApiProblem extends Error {
  readonly problem: Problem

  constructor(problem: Problem) {
    super(problem.code)
    this.problem = problem
  }
}

async function problemFrom(response: Response): Promise<ApiProblem> {
  try {
    return new ApiProblem((await response.json()) as Problem)
  } catch {
    return new ApiProblem({
      type: '/problems/internal-error',
      title: 'Request failed',
      status: response.status,
      code: 'internal_error',
      detail: 'The request could not be completed.',
    })
  }
}

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
  if (!response.ok) throw await problemFrom(response)
  return (await response.json()) as Session
}

export const login = (input: LoginInput) => requestSession('login', input)
export const signup = (input: SignupInput) => requestSession('signup', input)

export async function logout() {
  const response = await fetch(
    new URL('/api/v1/sessions/current', window.location.origin),
    {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/problem+json' },
    },
  )
  if (!response.ok) throw await problemFrom(response)
}

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
    throw new Error(`Session request failed with status ${response.status}`)
  }

  return (await response.json()) as Session
}
