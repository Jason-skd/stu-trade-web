import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../shared/components/Page.tsx'
import { useSession } from './session-context.ts'

// === render authenticated profile ===

/** 渲染当前用户资料和退出操作。 */
export function ProfilePage() {
  const session = useSession()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState(false)

  async function handleLogout() {
    setLogoutError(false)
    try {
      await session.logout()
      navigate('/', { replace: true, flushSync: true })
    } catch {
      setLogoutError(true)
    }
  }

  return (
    <Page title="我的">
      {session.status === 'authenticated' && (
        <>
          <p className="page__prompt">{session.session.user.nickname}</p>
          {logoutError && <p role="alert">退出失败，请稍后重试。</p>}
          <button type="button" onClick={handleLogout}>退出登录</button>
        </>
      )}
    </Page>
  )
}
