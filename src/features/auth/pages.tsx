import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiProblem, type LoginInput, type SignupInput } from '../../api/session.ts'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from './session-context.ts'
import './auth.css'

function returnTarget(value: string | null) { return value?.startsWith('/') && !value.startsWith('//') ? value : '/' }
function message(error: unknown) {
  if (error instanceof ApiProblem) {
    if (error.problem.code === 'invalid_credentials') return '邮箱或密码不正确。'
    if (error.problem.code === 'email_taken') return '该邮箱已注册，请直接登录。'
    if (error.problem.code === 'validation_failed') return '请检查填写内容后重试。'
  }
  return '服务暂时不可用，请稍后重试。'
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const session = useSession(), navigate = useNavigate(), [params] = useSearchParams()
  const target = returnTarget(params.get('returnTo'))
  const [error, setError] = useState(''), [submitting, setSubmitting] = useState(false)
  const submissionLocked = useRef(false)
  if (session.status === 'authenticated') return <Navigate replace to={target} />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submissionLocked.current) return
    submissionLocked.current = true
    const form = new FormData(event.currentTarget), email = String(form.get('email')).trim(), password = String(form.get('password')), nickname = String(form.get('nickname') ?? '').trim()
    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址。')
      submissionLocked.current = false
      return
    }
    if (mode === 'signup' && !nickname) {
      setError('请输入昵称。')
      submissionLocked.current = false
      return
    }
    if (mode === 'signup' && password.length < 8) {
      setError('密码至少需要 8 位。')
      submissionLocked.current = false
      return
    }
    setError(''); setSubmitting(true)
    try {
      if (mode === 'login') await session.login({ email, password } satisfies LoginInput)
      else await session.signup({ email, nickname, password } satisfies SignupInput)
      navigate(target, { replace: true })
    } catch (cause) {
      setError(message(cause))
    } finally {
      submissionLocked.current = false
      setSubmitting(false)
    }
  }
  const other = `${mode === 'login' ? '/signup' : '/login'}${target === '/' ? '' : `?returnTo=${encodeURIComponent(target)}`}`
  return <Page title={mode === 'login' ? '登录' : '注册'}><div className="auth-layout">
    <p className="auth-intro">用校园身份继续发布、撮合与面交。</p>
    <form className="auth-form" onSubmit={submit}>
      <label>邮箱<input name="email" type="email" autoComplete="email" required /></label>
      {mode === 'signup' && <label>昵称<input name="nickname" autoComplete="nickname" required /></label>}
      <label>密码<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} required /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button disabled={submitting} type="submit">{submitting ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}</button>
    </form>
    <p className="page__prompt">{mode === 'login' ? '还没有账户？' : '已有账户？'}<Link to={other}>{mode === 'login' ? '注册' : '登录'}</Link></p>
  </div></Page>
}
export const LoginPage = () => <AuthPage mode="login" />
export const SignupPage = () => <AuthPage mode="signup" />
