import { Link } from 'react-router-dom'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from '../auth/session-context.ts'

export function MarketplacePage() {
  return <Page title="市集" />
}

export function PublishPage() {
  return <Page title="发布" />
}

export function ProfilePage() {
  const session = useSession()

  return (
    <Page title="我的">
      {session.status === 'authenticated' ? (
        <p className="page__prompt">{session.session.user.nickname}</p>
      ) : (
        <p className="page__prompt">
          尚未登录。<Link to="/login">登录</Link>
        </p>
      )}
    </Page>
  )
}
