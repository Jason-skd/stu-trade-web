import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './page.css'

// === define page presentation ===

type PageProps = {
  children?: ReactNode
  title: string
}

/** 渲染带统一标题装饰的页面容器。 */
export function Page({ children, title }: PageProps) {
  return (
    <section className="page">
      <header className="page__header">
        <h1>{title}</h1>
        <div className="page__shelf" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>
      {children}
    </section>
  )
}

// === render missing page ===

/** 渲染未知路由的返回入口。 */
export function NotFoundPage() {
  return (
    <Page title="页面不存在">
      <p className="page__prompt">
        <Link to="/">返回市集</Link>
      </p>
    </Page>
  )
}
