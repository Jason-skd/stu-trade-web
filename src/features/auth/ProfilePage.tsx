import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../shared/components/Page.tsx'
import { useLocale } from '../../app/locale-context.ts'
import { useSession } from './session-context.ts'

// === render authenticated profile ===

/** 渲染当前用户资料和退出操作。 */
export function ProfilePage() {
  const session = useSession()
  const { messages } = useLocale()
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
    <Page title={messages.shell.nav.profile}>
      {session.status === 'authenticated' && (
        <>
          <p className="page__prompt">{session.session.user.nickname}</p>
          {logoutError && <p role="alert">{messages.auth.errors.logout}</p>}
          <button type="button" onClick={handleLogout}>{messages.auth.logout}</button>
        </>
      )}
    </Page>
  )
}
