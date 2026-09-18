import type { components } from './generated/schema.ts'

// === define api problem contract ===

type Problem = components['schemas']['Problem']

/** 表示服务端返回的结构化 API 问题。 */
export class ApiProblem extends Error {
  readonly problem: Problem

  constructor(problem: Problem, options?: ErrorOptions) {
    super(problem.code, options)
    this.name = 'ApiProblem'
    this.problem = problem
  }
}

// === validate api problem payload ===

function isProblem(value: unknown): value is Problem {
  if (!value || typeof value !== 'object') return false

  const problem = value as Record<string, unknown>
  return (
    typeof problem.type === 'string' &&
    typeof problem.title === 'string' &&
    Number.isInteger(problem.status) &&
    Number(problem.status) >= 400 &&
    Number(problem.status) <= 599 &&
    typeof problem.code === 'string' &&
    typeof problem.detail === 'string'
  )
}

function fallbackProblem(response: Response): Problem {
  const status = response.status >= 400 && response.status <= 599
    ? response.status
    : 500

  return {
    type: '/problems/internal-error',
    title: 'Request failed',
    status,
    code: 'internal_error',
    detail: 'The request could not be completed.',
  }
}

// === decode api problem response ===

/** 将失败的 HTTP 响应转换为稳定的 API 错误身份。 */
export async function apiProblemFrom(response: Response): Promise<ApiProblem> {
  try {
    const payload: unknown = await response.json()
    if (!isProblem(payload)) {
      throw new TypeError('API problem response does not match the contract.')
    }
    return new ApiProblem(payload)
  } catch (cause) {
    return new ApiProblem(fallbackProblem(response), { cause })
  }
}
