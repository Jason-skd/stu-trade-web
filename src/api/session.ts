import type { components } from './generated/schema.ts'

export type Session = components['schemas']['Session']

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
