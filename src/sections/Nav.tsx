import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Github, Menu, X } from 'lucide-react'
import { profile } from '@/data/github'
import { copy } from '@/data/copy'
import ThemeToggle from '@/components/ThemeToggle'

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
    { href: '#top', label: copy.nav.home },
    { href: '#recent', label: copy.nav.recent },
    { href: '#projects', label: copy.nav.projects },
    { href: '#toolbox', label: copy.nav.toolbox },
    { href: '#about', label: copy.nav.about },
  ]

  // 胶囊滑动：首次出现直接就位（无动画），此后 active 变化时 0.35s 滑到新项。
  // overwrite:'auto' 杀掉同属性旧 tween——快速滚动时多个滑行请求不会互相覆盖卡死。
  // 横向 ±6px 呼吸边距，保证胶囊完全罩住文字。
  useEffect(() => {
    const nav = desktopNavRef.current
    const pill = pillRef.current
    if (!nav || !pill) return
    const link = nav.querySelector<HTMLAnchorElement>(`a[data-anchor="${active}"]`)
    if (!link || !nav.offsetParent) return
    const target = { x: link.offsetLeft - 6, width: link.offsetWidth + 12 }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prevActive.current === '' || reduce) gsap.set(pill, target)
    else {
      // 滑动期间关 blur（backdrop-filter 每帧重采样），滑完恢复真玻璃
      pill.classList.add('is-moving')
      gsap.to(pill, {
        ...target,
        duration: 0.35,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => pill.classList.remove('is-moving'),
      })
    }
    prevActive.current = active
  }, [active])

  // 断点跨越 / 字体加载导致宽度变化时，无动画重新就位（读 ref 里的当前 active，不随其重跑）
  useEffect(() => {
    const reposition = () => {
      const nav = desktopNavRef.current
      const pill = pillRef.current
      if (!nav || !pill || !nav.offsetParent) return
      const link = nav.querySelector<HTMLAnchorElement>(`a[data-anchor="${activeRef.current}"]`)
      if (!link) return
      gsap.set(pill, { x: link.offsetLeft - 6, width: link.offsetWidth + 12 })
    }
    window.addEventListener('resize', reposition)
    document.fonts?.ready.then(reposition).catch(() => {})
    return () => window.removeEventListener('resize', reposition)
  }, [])

  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: 'var(--nav-bg)', borderColor: 'var(--line)' }}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-xl font-extrabold tracking-wide">
          {copy.nav.brand}
          <span className="text-accent">{copy.nav.brandDot}</span>
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

          <ThemeToggle />

          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-pop hidden items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-[var(--accent-ink)] sm:flex"
          >
            <Github className="h-4 w-4" />
            {copy.nav.github}
          </a>

          {/* 移动端菜单按钮 */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? copy.nav.menuClose : copy.nav.menuOpen}
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
            aria-label={copy.nav.menuOpen}
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-[var(--accent-ink)]"
                >
                  <Github className="h-4 w-4" />
                  {copy.nav.github}
                </a>
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
