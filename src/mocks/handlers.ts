import { http, HttpResponse } from 'msw'
import type { components } from '../api/generated/schema.ts'

type Problem = components['schemas']['Problem']

const unauthenticatedProblem = {
  type: '/problems/unauthenticated',
  title: 'Unauthenticated',
  status: 401,
  code: 'unauthenticated',
  detail: 'A valid session is required.',
} satisfies Problem

export const handlers = [
  http.get('*/api/v1/sessions/current', () =>
    HttpResponse.json(unauthenticatedProblem, {
      status: 401,
      headers: { 'Content-Type': 'application/problem+json' },
    }),
  ),
]
