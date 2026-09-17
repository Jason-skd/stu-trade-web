import { http, HttpResponse } from 'msw'
import type { components } from '../api/generated/schema.ts'

type Problem = components['schemas']['Problem']
type Session = components['schemas']['Session']
type LoginInput = components['schemas']['LoginInput']
type SignupInput = components['schemas']['SignupInput']

const unauthenticatedProblem = {
  type: '/problems/unauthenticated',
  title: 'Unauthenticated',
  status: 401,
  code: 'unauthenticated',
  detail: 'A valid session is required.',
} satisfies Problem

let currentSession: Session | null = null

export const handlers = [
  http.post('*/api/v1/login', async ({ request }) => {
    const input = (await request.json()) as LoginInput
    currentSession = {
      user: { id: 'mock-user', nickname: '校园用户', email: input.email },
    }
    return HttpResponse.json(currentSession)
  }),
  http.post('*/api/v1/signup', async ({ request }) => {
    const input = (await request.json()) as SignupInput
    currentSession = {
      user: { id: 'mock-user', nickname: input.nickname, email: input.email },
    }
    return HttpResponse.json(currentSession, { status: 201 })
  }),
  http.get('*/api/v1/sessions/current', () => {
    if (currentSession) return HttpResponse.json(currentSession)
    return HttpResponse.json(unauthenticatedProblem, {
      status: 401,
      headers: { 'Content-Type': 'application/problem+json' },
    })
  }),
  http.delete('*/api/v1/sessions/current', () => {
    currentSession = null
    return new HttpResponse(null, { status: 204 })
  }),
]
