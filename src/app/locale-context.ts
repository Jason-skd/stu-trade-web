import { createContext, useContext } from 'react'
import { messagesByLocale, type Messages } from './messages.ts'

// === define locale context ===

/** 界面支持的语言标识。 */
export type Locale = keyof typeof messagesByLocale

/** 当前语言环境向组件提供的文案、切换与格式化能力。 */
export type LocaleContextValue = {
  locale: Locale
  messages: Messages
  setLocale: (locale: Locale) => void
  formatMoney: (amount: number) => string
}

/** 在应用组件树中传递当前语言环境。 */
export const LocaleContext = createContext<LocaleContextValue | null>(null)

// === expose the active locale ===

/** 读取当前界面语言、文案和本地化格式化能力。 */
export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used within LocaleProvider')
  return value
}
