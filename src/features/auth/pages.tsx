import { Link } from 'react-router-dom'
import { Page } from '../../shared/components/Page.tsx'

export function LoginPage() {
  return (
    <Page title="登录">
      <p className="page__prompt">
        还没有账户？<Link to="/signup">注册</Link>
      </p>
    </Page>
  )
}

export function SignupPage() {
  return (
    <Page title="注册">
      <p className="page__prompt">
        已有账户？<Link to="/login">登录</Link>
      </p>
    </Page>
  )
}
