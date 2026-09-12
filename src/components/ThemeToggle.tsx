import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useT } from '@/hooks/useLocale'

/** 明暗主题开关：跟随系统为默认，手动选择存 localStorage */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const t = useT()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? t.theme.toDark : t.theme.toLight}
      title={next === 'dark' ? t.theme.toDarkTitle : t.theme.toLightTitle}
      className="glass flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-transform hover:scale-110 hover:text-foreground active:scale-95"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
