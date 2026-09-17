import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from '../auth/session-context.ts'

export function MarketplacePage() { return <Page title="市集" /> }
export function PublishPage() { return <Page title="发布" /> }

export function ProfilePage() {
  const session = useSession()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState(false)
  async function handleLogout() {
    setLogoutError(false)
    try { await session.logout(); navigate('/') } catch { setLogoutError(true) }
  }
  return <Page title="我的">
    {session.status === 'authenticated' && <>
      <p className="page__prompt">{session.session.user.nickname}</p>
      {logoutError && <p role="alert">退出失败，请稍后重试。</p>}
      <button onClick={handleLogout}>退出登录</button>
    </>}
  </Page>
}
