import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function storedTheme(): Theme | null {
  const t = localStorage.getItem(STORAGE_KEY)
  return t === 'light' || t === 'dark' ? t : null
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

// ── 模块级小商店：多个组件（Nav 开关、猫卡）共享同一主题状态 ──
let current: Theme =
  typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light'

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
  apply(current)
  // 没有手动选择过主题时，跟随系统变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!storedTheme()) {
      current = e.matches ? 'dark' : 'light'
      apply(current)
      emit()
    }
  })
}
init()

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'light' as Theme,
  )

  const setTheme = useCallback((t: Theme) => {
    current = t
    localStorage.setItem(STORAGE_KEY, t)
    apply(t)
    emit()
  }, [])

  return [theme, setTheme]
}
