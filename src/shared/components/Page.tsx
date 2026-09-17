import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './page.css'

type PageProps = {
  children?: ReactNode
  title: string
}

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

export function NotFoundPage() {
  return (
    <Page title="页面不存在">
      <p className="page__prompt">
        <Link to="/">返回市集</Link>
      </p>
    </Page>
  )
}
