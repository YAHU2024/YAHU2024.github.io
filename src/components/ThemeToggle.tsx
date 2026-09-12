import { useRef } from 'react'
import { Moon, Sun } from 'lucide-react'
import gsap from 'gsap'
import { useTheme } from '@/hooks/useTheme'
import { useT } from '@/hooks/useLocale'

/** 明暗主题开关：跟随系统为默认，手动选择存 localStorage。
    点击动效：图标沿 Y 轴拨杆式翻转（back.out 回弹），主题状态在翻转中点
    （图标侧对观众、不可见）切换，换脸与全站配色同步发生 */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const t = useT()
  const iconRef = useRef<HTMLSpanElement>(null)
  const next = theme === 'dark' ? 'light' : 'dark'

  const flip = () => {
    const el = iconRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(next)
      return
    }
    gsap.killTweensOf(el)
    gsap.set(el, { rotationY: 0, transformPerspective: 120 })
    gsap
      .timeline()
      .to(el, { rotationY: 90, duration: 0.15, ease: 'power2.in' })
      // 中点切状态：此刻图标侧对观众（90° 不可见），换脸无感
      .call(() => setTheme(next))
      .set(el, { rotationY: -90 })
      .to(el, { rotationY: 0, duration: 0.32, ease: 'back.out(1.6)' })
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={next === 'dark' ? t.theme.toDark : t.theme.toLight}
      title={next === 'dark' ? t.theme.toDarkTitle : t.theme.toLightTitle}
      className="toggle-pop glass flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground/80 hover:text-foreground"
    >
      <span ref={iconRef} className="flex">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
    </button>
  )
}
