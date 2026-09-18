import { Page } from '../../shared/components/Page.tsx'
import { useLocale } from '../../app/locale-context.ts'

// === render matches placeholder ===

/** 渲染尚待实现的撮合入口。 */
export function MatchesPage() {
  const { messages } = useLocale()
  return <Page title={messages.matches.title} />
}
