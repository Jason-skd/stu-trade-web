import { describe, expect, it } from 'vitest'
import type { components } from './generated/schema.ts'
import { apiProblemFrom } from './problem.ts'

// === verify api problem decoding ===

describe('API problem decoding', () => {
  it('preserves a valid structured problem identity', async () => {
    const problem = {
      type: '/problems/not-found',
      title: 'Not found',
      status: 404,
      code: 'not_found',
      detail: 'The requested listing does not exist.',
    } satisfies components['schemas']['Problem']
    const response = Response.json(problem, { status: 404 })

    const error = await apiProblemFrom(response)

    expect(error.problem).toEqual(problem)
    expect(error.message).toBe('not_found')
  })

  it('retains the parsing cause behind a stable fallback identity', async () => {
    const response = Response.json({ unexpected: true }, { status: 502 })

    const error = await apiProblemFrom(response)

    expect(error.problem).toMatchObject({
      status: 502,
      code: 'internal_error',
    })
    expect(error.cause).toBeInstanceOf(TypeError)
  })
})
