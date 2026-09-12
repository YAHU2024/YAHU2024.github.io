import { useCallback, useSyncExternalStore } from 'react'
import { dictionaries, type Copy } from '@/data/copy'

export type Locale = 'zh' | 'en'

/** 内容数据层的双语字段：{ zh, en }；读取经 useTL()，缺英文自动取中文（L 两键均必填，fallback 仅兜未来新增语言） */
export interface L {
  zh: string
  en: string
}

const STORAGE_KEY = 'yahu.locale'

function storedLocale(): Locale | null {
  const l = localStorage.getItem(STORAGE_KEY)
  return l === 'zh' || l === 'en' ? l : null
}

/** 无手动选择时跟随浏览器：navigator.language 含 zh → 中文，否则英文 */
function browserLocale(): Locale {
  const lang = navigator.language?.toLowerCase() ?? ''
  return lang.startsWith('zh') ? 'zh' : 'en'
}

function apply(locale: Locale) {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  // 同步 SEO：document.title + description（og/twitter 对爬虫无效，浏览器内一致即可）
  const { seo } = dictionaries[locale]
  document.title = seo.title
  const setMeta = (selector: string, value: string) => {
    document.querySelector(selector)?.setAttribute('content', value)
  }
  setMeta('meta[name="description"]', seo.description)
  setMeta('meta[property="og:title"]', seo.title)
  setMeta('meta[property="og:description"]', seo.description)
  setMeta('meta[name="twitter:title"]', seo.title)
  setMeta('meta[name="twitter:description"]', seo.description)
}

// ── 模块级小商店（与 useTheme 同构）：Nav 开关与所有文案消费组件共享同一语言状态 ──
let current: Locale = 'zh'

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function init() {
  if (typeof window === 'undefined') return
  current = storedLocale() ?? browserLocale()
  apply(current)
}
init()

export function useLocale(): [Locale, (l: Locale) => void] {
  const locale = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'zh' as Locale,
  )

  const setLocale = useCallback((l: Locale) => {
    current = l
    localStorage.setItem(STORAGE_KEY, l)
    apply(l)
    emit()
  }, [])

  return [locale, setLocale]
}

/** 当前语言的界面文案字典树；用法：const t = useT() → t.nav.home */
export function useT(): Copy {
  const [locale] = useLocale()
  return dictionaries[locale]
}

/** 内容数据层双语字段读取器；用法：const tl = useTL() → tl(item.oneLine) */
export function useTL(): (l: L) => string {
  const [locale] = useLocale()
  return useCallback((l: L) => l[locale], [locale])
}
