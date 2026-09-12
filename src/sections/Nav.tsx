import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Github, Menu, X } from 'lucide-react'
import { profile } from '@/data/github'
import { useT } from '@/hooks/useLocale'
import ThemeToggle from '@/components/ThemeToggle'
import LangToggle from '@/components/LangToggle'

interface NavProps {
  /** 当前激活锚点（top / recent / projects / toolbox / about），由 Home 的滚动侦测与视图状态驱动 */
  active: string
}

/**
 * 顶部导航：
 * - 桌面（sm+）：首页 / 最近 / 项目 / 工具箱 / 关于 + 主题切换 + GitHub 按钮
 *   active 项由 accent-soft 玻璃胶囊标记（GSAP 驱动 x/width 滑动），文字变 accent
 * - 移动（<sm）：锚点链接折叠进汉堡抽屉（玻璃面板 + 大触控行），点选后平滑滚动并收起
 * - 抽屉可访问性：aria-expanded / aria-controls / Esc 关闭 / 点击遮罩关闭
 */
export default function Nav({ active }: NavProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const desktopNavRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const prevActive = useRef('')
  const activeRef = useRef(active)
  activeRef.current = active

  // Esc 关闭抽屉
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  const navItems = [
    { href: '#top', label: t.nav.home },
    { href: '#recent', label: t.nav.recent },
    { href: '#projects', label: t.nav.projects },
    { href: '#toolbox', label: t.nav.toolbox },
    { href: '#about', label: t.nav.about },
  ]

  // ── 胶囊定位（统一几何出口）──
  // 读取当前 active 对应链接的几何位置，animate=true 滑动过去，false 原地吸附。
  // 横向 ±6px 呼吸边距，保证胶囊完全罩住文字。
  const positionPill = useCallback((animate: boolean) => {
    const nav = desktopNavRef.current
    const pill = pillRef.current
    if (!nav || !pill || !nav.offsetParent) return
    const link = nav.querySelector<HTMLAnchorElement>(`a[data-anchor="${activeRef.current}"]`)
    if (!link) return
    const target = { x: link.offsetLeft - 6, width: link.offsetWidth + 12 }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animate || reduce || prevActive.current === '') {
      gsap.set(pill, target)
    } else {
      // 滑动期间关 blur（backdrop-filter 每帧重采样），滑完恢复真玻璃；
      // overwrite:'auto' 杀掉同属性旧 tween——快速滚动时多个滑行请求不会互相覆盖卡死
      pill.classList.add('is-moving')
      gsap.to(pill, {
        ...target,
        duration: 0.35,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => pill.classList.remove('is-moving'),
      })
    }
    prevActive.current = activeRef.current
  }, [])

  // active 变化 → 滑动到新项；首次挂载直接就位（无动画）
  useEffect(() => {
    positionPill(true)
  }, [active, positionPill])

  // 任何导航链接宽度变化（语言切换 / 文案修改 / 字体加载 / 系统缩放 / 断点跨越）
  // → 无动画原地重新就位。观察链接本体而非监听 resize 事件：与宽度变化的成因彻底解耦，
  //   内容换语言这类「事件型监听覆盖不到」的变更也能被捕获；胶囊定位不改变链接尺寸，无回环风险。
  useEffect(() => {
    const nav = desktopNavRef.current
    if (!nav) return
    const ro = new ResizeObserver(() => positionPill(false))
    ro.observe(nav)
    nav.querySelectorAll('a[data-anchor]').forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [positionPill])

  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: 'var(--nav-bg)', borderColor: 'var(--line)' }}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-xl font-extrabold tracking-wide">
          {t.nav.brand}
          <span className="text-accent">{t.nav.brandDot}</span>
        </a>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* 桌面导航链接（<640px 隐藏，由汉堡抽屉接管）：胶囊背景 + 激活态文字 */}
          <nav
            ref={desktopNavRef}
            className="relative hidden items-center gap-6 text-[0.95rem] font-semibold text-muted sm:flex"
          >
            <span ref={pillRef} className="nav-pill" aria-hidden />
            {navItems.map((l) => {
              const anchor = l.href.slice(1)
              const isActive = anchor === active
              return (
                <a
                  key={l.href}
                  href={l.href}
                  data-anchor={anchor}
                  aria-current={isActive || undefined}
                  className={`nav-link${isActive ? ' is-active' : ''}`}
                >
                  {l.label}
                </a>
              )
            })}
          </nav>

          <LangToggle />

          <ThemeToggle />

          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-pop btn-accent-glass hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-[var(--accent-ink)] sm:flex"
          >
            <Github className="h-4 w-4" />
            {t.nav.github}
          </a>

          {/* 移动端菜单按钮 */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.nav.menuClose : t.nav.menuOpen}
            className="btn-pop -mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-foreground sm:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 移动端抽屉：玻璃面板 + 大触控行 */}
      {open && (
        <>
          {/* 遮罩：只盖正文区（top-16 以下），header 本身保持可交互 */}
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/30 sm:hidden"
            onClick={close}
            aria-hidden
          />
          <nav
            id="mobile-nav"
            aria-label={t.nav.menuOpen}
            className="menu-in absolute top-full right-4 z-50 w-64 sm:hidden"
          >
            <div className="pt-2">
              <div className="menu-panel rounded-2xl p-1.5">
                {navItems.map((l) => {
                  const isActive = l.href.slice(1) === active
                  return (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={close}
                      aria-current={isActive || undefined}
                      className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-extrabold transition-colors hover:bg-[var(--glass-strong)]${
                        isActive ? ' text-accent' : ''
                      }`}
                    >
                      {l.label}
                      <span className="ar-pop text-sm text-accent" aria-hidden>
                        →
                      </span>
                    </a>
                  )
                })}
                <div
                  className="mx-2 my-1.5 h-px"
                  style={{ background: 'var(--line)' }}
                  aria-hidden
                />
                <a
                  href={profile.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                  className="btn-accent-glass flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold"
                >
                  <Github className="h-4 w-4" />
                  {t.nav.github}
                </a>
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
