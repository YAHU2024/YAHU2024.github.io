import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

/** 明暗主题开关：跟随系统为默认，手动选择存 localStorage */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? '切换到深色主题' : '切换到浅色主题'}
      title={next === 'dark' ? '切到夜晚 🌙' : '切到白天 ☀️'}
      className="glass flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-transform hover:scale-110 hover:text-foreground active:scale-95"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
