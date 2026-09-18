import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  LocaleContext,
  type Locale,
  type LocaleContextValue,
} from './locale-context.ts'
import { messagesByLocale } from './messages.ts'

// === define locale contract ===

const defaultLocale: Locale = 'en'
const localeStorageKey = 'stutrade.locale'

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'zh-CN'
}

function readLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  try {
    const stored = window.localStorage.getItem(localeStorageKey)
    return isLocale(stored) ? stored : defaultLocale
  } catch {
    return defaultLocale
  }
}

// === provide the active locale ===

/** 管理当前界面语言、浏览器持久化和文档语言元数据。 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readLocale)
  const messages = messagesByLocale[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', messages.shell.description)
    try {
      window.localStorage.setItem(localeStorageKey, locale)
    } catch {
      // 浏览器禁止存储时仍保留本次页面中的语言选择。
    }
  }, [locale, messages.shell.description])

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    messages,
    setLocale,
    formatMoney: (amount) => new Intl.NumberFormat(
      locale === 'en' ? 'en-US' : 'zh-CN',
      { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 },
    ).format(amount / 100),
  }), [locale, messages])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
