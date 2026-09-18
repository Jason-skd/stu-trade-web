import {
  BookOpen,
  ClipboardList,
  Handshake,
  LibraryBig,
  PlusSquare,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useSession } from '../../features/auth/session-context.ts'
import './app-shell.css'

// === define primary navigation ===

type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
  end?: boolean
}

const navigation: NavigationItem[] = [
  { label: '市集', path: '/', icon: LibraryBig, end: true },
  { label: '发布', path: '/publish', icon: PlusSquare },
  { label: '撮合', path: '/matches', icon: Handshake },
  { label: '订单', path: '/orders', icon: ClipboardList },
  { label: '我的', path: '/me', icon: UserRound },
]

// === render navigation links ===

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return navigation.map(({ label, path, icon: Icon, end }) => (
    <NavLink
      className={({ isActive }) =>
        `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
      }
      end={end}
      key={path}
      to={path}
    >
      {mobile && <Icon aria-hidden="true" size={20} strokeWidth={1.8} />}
      <span>{label}</span>
    </NavLink>
  ))
}

// === render application shell ===

/** 渲染响应式主导航和当前路由内容。 */
export function AppShell() {
  const session = useSession()
  const accountLabel =
    session.status === 'authenticated' ? session.session.user.nickname : '登录'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="brand" to="/" aria-label="StuTrade 首页">
            <span className="brand__mark" aria-hidden="true">
              <BookOpen size={22} strokeWidth={1.8} />
            </span>
            <span>StuTrade</span>
          </Link>

          <nav className="app-nav app-nav--desktop" aria-label="主导航">
            <NavigationLinks />
          </nav>

          <Link
            className="account-link"
            to={session.status === 'authenticated' ? '/me' : '/login'}
          >
            <UserRound aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{accountLabel}</span>
          </Link>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="app-nav app-nav--mobile" aria-label="移动导航">
        <NavigationLinks mobile />
      </nav>
    </div>
  )
}
