import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiProblem } from '../../api/problem.ts'
import type { LoginInput, SignupInput } from '../../api/session.ts'
import { useLocale } from '../../app/locale-context.ts'
import type { Messages } from '../../app/messages.ts'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from './session-context.ts'
import './auth.css'

// === resolve authentication navigation ===

function safeReturnTarget(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

type AuthError = keyof Messages['auth']['errors']

function authenticationError(error: unknown): AuthError {
  if (error instanceof ApiProblem) {
    if (error.problem.code === 'invalid_credentials') {
      return 'invalidCredentials'
    }
    if (error.problem.code === 'email_taken') {
      return 'emailTaken'
    }
    if (error.problem.code === 'validation_failed') {
      return 'validationFailed'
    }
  }
  return 'unavailable'
}

// === render authentication form ===

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const session = useSession()
  const { messages } = useLocale()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const target = safeReturnTarget(params.get('returnTo'))
  const [error, setError] = useState<AuthError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submissionLocked = useRef(false)

  if (session.status === 'authenticated') return <Navigate replace to={target} />

  // === submit authentication credentials ===

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionLocked.current) return

    submissionLocked.current = true
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    const nickname = String(form.get('nickname') ?? '').trim()

    if (!email || !email.includes('@')) {
      setError('invalidEmail')
      submissionLocked.current = false
      return
    }
    if (mode === 'signup' && !nickname) {
      setError('missingNickname')
      submissionLocked.current = false
      return
    }
    if (email.length > 254) {
      setError('emailTooLong')
      submissionLocked.current = false
      return
    }
    if (mode === 'signup' && nickname.length > 50) {
      setError('nicknameTooLong')
      submissionLocked.current = false
      return
    }
    if (password.length < 8) {
      setError('passwordTooShort')
      submissionLocked.current = false
      return
    }
    if (password.length > 128) {
      setError('passwordTooLong')
      submissionLocked.current = false
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await session.login({ email, password } satisfies LoginInput)
      } else {
        await session.signup({ email, nickname, password } satisfies SignupInput)
      }
      navigate(target, { replace: true })
    } catch (cause) {
      setError(authenticationError(cause))
    } finally {
      submissionLocked.current = false
      setSubmitting(false)
    }
  }

  const alternatePage = mode === 'login' ? '/signup' : '/login'
  const returnQuery = target === '/'
    ? ''
    : `?returnTo=${encodeURIComponent(target)}`
  const alternateTarget = `${alternatePage}${returnQuery}`

  return (
    <Page title={mode === 'login' ? messages.auth.login : messages.auth.signup}>
      <div className="auth-layout">
        <p className="auth-intro" role={target === '/' ? undefined : 'status'}>
          {target === '/'
            ? messages.auth.intro
            : messages.auth.returnIntro}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            {messages.auth.email}
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          {mode === 'signup' && (
            <label>
              {messages.auth.nickname}
              <input
                name="nickname"
                autoComplete="nickname"
                maxLength={50}
                required
              />
            </label>
          )}
          <label>
            {messages.auth.password}
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          {error && <p className="auth-error" role="alert">{messages.auth.errors[error]}</p>}
          <button disabled={submitting} type="submit">
            {submitting
              ? messages.auth.submitting
              : mode === 'login' ? messages.auth.login : messages.auth.signupAndLogin}
          </button>
        </form>
        <p className="page__prompt">
          {mode === 'login' ? messages.auth.noAccount : messages.auth.hasAccount}
          <Link to={alternateTarget}>
            {mode === 'login' ? messages.auth.signup : messages.auth.login}
          </Link>
        </p>
      </div>
    </Page>
  )
}

// === expose authentication pages ===

/** 渲染登录页面。 */
export const LoginPage = () => <AuthPage mode="login" />

/** 渲染注册页面。 */
export const SignupPage = () => <AuthPage mode="signup" />
