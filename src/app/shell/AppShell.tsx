import {
  BookOpen,
  ClipboardList,
  Handshake,
  LibraryBig,
  ListChecks,
  PlusSquare,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useLocale, type Locale } from '../locale-context.ts'
import { useSession } from '../../features/auth/session-context.ts'
import './app-shell.css'

// === define primary navigation ===

type NavigationItem = {
  label: 'marketplace' | 'publish' | 'myListings' | 'matches' | 'orders' | 'profile'
  path: string
  icon: LucideIcon
  end?: boolean
}

const navigation: NavigationItem[] = [
  { label: 'marketplace', path: '/', icon: LibraryBig, end: true },
  { label: 'publish', path: '/publish', icon: PlusSquare },
  { label: 'myListings', path: '/my-listings', icon: ListChecks },
  { label: 'matches', path: '/matches', icon: Handshake },
  { label: 'orders', path: '/orders', icon: ClipboardList },
  { label: 'profile', path: '/me', icon: UserRound },
]

// === render navigation links ===

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const { messages } = useLocale()
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
      <span>{messages.shell.nav[label]}</span>
    </NavLink>
  ))
}

// === switch the active locale ===

function LanguageSwitcher() {
  const { locale, messages, setLocale } = useLocale()
  const options: { label: string; value: Locale }[] = [
    { label: messages.shell.english, value: 'en' },
    { label: messages.shell.chinese, value: 'zh-CN' },
  ]

  return (
    <div className="language-switcher" role="group" aria-label={messages.shell.language}>
      {options.map((option) => (
        <button
          aria-pressed={locale === option.value}
          key={option.value}
          onClick={() => setLocale(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// === render application shell ===

/** 渲染响应式主导航和当前路由内容。 */
export function AppShell() {
  const session = useSession()
  const { messages } = useLocale()
  const accountLabel =
    session.status === 'authenticated' ? session.session.user.nickname : messages.shell.login

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="brand" to="/" aria-label={messages.shell.home}>
            <span className="brand__mark" aria-hidden="true">
              <BookOpen size={22} strokeWidth={1.8} />
            </span>
            <span>StuTrade</span>
          </Link>

          <nav className="app-nav app-nav--desktop" aria-label={messages.shell.primaryNavigation}>
            <NavigationLinks />
          </nav>

          <div className="app-header__actions">
            <LanguageSwitcher />
            <Link
              className="account-link"
              to={session.status === 'authenticated' ? '/me' : '/login'}
            >
              <UserRound aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{accountLabel}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="app-nav app-nav--mobile" aria-label={messages.shell.mobileNavigation}>
        <NavigationLinks mobile />
      </nav>
    </div>
  )
}
