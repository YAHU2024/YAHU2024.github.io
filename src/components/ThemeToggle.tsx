import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'
import gsap from 'gsap'
import { useTheme } from '@/hooks/useTheme'
import { useT } from '@/hooks/useLocale'

/** 主题配色渐变时长，与 .glass / .theme-transitioning 的 0.45s 同族 */
const FADE_MS = 450

/** 明暗主题开关：跟随系统为默认，手动选择存 localStorage。
    切换过渡分两层（渐进增强），且带方向语义：
    - 支持 View Transitions：入夜=旧画面（白天）缩进按钮（收缩）；天亮=新画面从按钮涌出（扩散）
    - 不支持：图标拨杆翻转 + 中点切状态，同时挂 .theme-transitioning 让全站颜色渐变
    - prefers-reduced-motion：一律瞬时切换，不演动画 */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const t = useT()
  const iconRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const fallbackTimer = useRef(0)
  const next = theme === 'dark' ? 'light' : 'dark'

  /** 兜底层：挂 .theme-transitioning 开启全站颜色渐变窗口，结束摘除 */
  const startColorFallback = () => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')
    window.clearTimeout(fallbackTimer.current)
    fallbackTimer.current = window.setTimeout(
      () => root.classList.remove('theme-transitioning'),
      FADE_MS + 250,
    )
  }

  const flip = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(next)
      return
    }
    const doc = document

    // 增强层：VT 圆形扩散。快照期间页面视觉静止，GSAP 图标翻转会被藏住，故跳过。
    // 方向语义：入夜=旧画面（白天）缩进按钮（收缩）；天亮=新画面（白天）从按钮涌出（扩散）
    if (doc.startViewTransition) {
      const shrink = next === 'dark'
      const root = document.documentElement
      if (shrink) root.dataset.vt = 'shrink'
      // 冻结 CSS 过渡：让「新画面快照」直接拍到终态配色，否则 .glass 系的 0.45s
      // 渐变会把过渡起点拍进快照，快照撤除时玻璃面跳色（切换后闪一下的根因）
      root.classList.add('theme-vt-freeze')
      const rect = btnRef.current?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      const r = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )
      const vt = doc.startViewTransition(() => {
        // React 状态是异步提交的，必须 flushSync 保证新快照在回调返回前完成渲染
        flushSync(() => setTheme(next))
      })
      vt.ready
        .then(() => {
          document.documentElement.animate(
            shrink
              ? { clipPath: [`circle(${r}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] }
              : { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
            {
              duration: 500,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              // 关键：保持终态到 teardown。无 fill 时动画结束 clip-path 回退本值——
              // 收缩向会瞬间整层弹回旧快照（白天盖回夜间页面）= 切换后「闪一下」
              fill: 'forwards',
              pseudoElement: shrink ? '::view-transition-old(root)' : '::view-transition-new(root)',
            },
          )
        })
        .catch(() => {}) // 被新转换顶掉时 ready 会 reject，静默即可
      vt.finished.finally(() => {
        delete root.dataset.vt
        root.classList.remove('theme-vt-freeze')
      })
      return
    }

    // 兜底层：图标拨杆翻转，中点切状态并开启全站配色渐变窗口
    const el = iconRef.current
    if (!el) {
      startColorFallback()
      setTheme(next)
      return
    }
    gsap.killTweensOf(el)
    gsap.set(el, { rotationY: 0, transformPerspective: 120 })
    gsap
      .timeline()
      .to(el, { rotationY: 90, duration: 0.15, ease: 'power2.in' })
      // 中点切状态：此刻图标侧对观众（90° 不可见），换脸无感
      .call(() => {
        startColorFallback()
        setTheme(next)
      })
      .set(el, { rotationY: -90 })
      .to(el, { rotationY: 0, duration: 0.32, ease: 'back.out(1.6)' })
  }

  return (
    <button
      ref={btnRef}
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
