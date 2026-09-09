import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import Nav from '@/sections/Nav'
import HeroLeft from '@/sections/Hero'
import RecentLeft from '@/sections/Recent'
import Projects from '@/sections/Projects'
import Toolbox from '@/sections/Toolbox'
import About from '@/sections/About'
import Footer from '@/sections/Footer'
import ScrollProgress from '@/components/ScrollProgress'
import CatCard, { type CatCardHandle } from '@/components/CatCard'
import Reveal from '@/components/Reveal'
import { useGitHub } from '@/hooks/useGitHub'
import { useScrollParallax } from '@/hooks/useScrollParallax'

type View = 'home' | 'recent'

/** '#recent' → 最近页；其余 hash（含空）→ 首页 */
const viewFromHash = (): View => (window.location.hash === '#recent' ? 'recent' : 'home')

const REDUCE_MQ = '(prefers-reduced-motion: reduce)'

/** 尘埃粒子：满配 24 颗，负 delay 让页面打开时已在半空 */
function useDust() {
  return useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i * 11 + 5) % 96}%`,
        delay: -i * 2.3,
        sway: i % 2 ? 42 : -36,
        d: 14 + ((i * 5) % 16),
      })),
    [],
  )
}

/**
 * 首页 / 最近页双视图容器：
 * - 视图由 URL hash 驱动（#recent），导航点击 / 后退 / 手改地址都能正确落位
 * - 左半屏内容随视图切换（模糊渐变转场），右半屏猫徽章常驻（切换时整圈翻转）
 * - 转场时序：旧内容 blur(8px) 淡出 250ms → 猫 rotateY 360° 700ms（t=0.1 起）
 *   → t=0.3 切换内容 → 新内容按块错峰 blur-in（每块 80ms）
 * - prefers-reduced-motion：直接切换 + 原生滚动，无翻转无模糊
 */
export default function Home() {
  const { repos, followers, publicRepos, live } = useGitHub()
  useScrollParallax()
  const dust = useDust()

  const [view, setView] = useState<View>(viewFromHash)
  const viewRef = useRef(view)
  viewRef.current = view

  const contentRef = useRef<HTMLDivElement>(null)
  const catApi = useRef<CatCardHandle>(null)
  const animating = useRef(false)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const pendingAnchor = useRef<string | null>(null)
  const prevView = useRef(view)

  /** 转场到目标视图；anchor 为切换完成后要滚动到的锚点（'top' = 回顶） */
  function transitionTo(next: View, anchor: string | null) {
    if (animating.current) {
      // 连点兜底：掐掉进行中的转场，清除现场后直接落位
      tlRef.current?.kill()
      gsap.set(contentRef.current, { clearProps: 'filter,visibility,opacity' })
      animating.current = false
    }
    pendingAnchor.current = anchor

    if (window.matchMedia(REDUCE_MQ).matches) {
      setView(next)
      return
    }

    animating.current = true
    const tl = gsap.timeline({
      onComplete: () => {
        animating.current = false
      },
    })
    tlRef.current = tl
    tl.to(contentRef.current, {
      filter: 'blur(8px)',
      autoAlpha: 0,
      duration: 0.25,
      ease: 'power2.in',
    })
      // 猫徽章整圈物理旋转（spin 内含 back.out 回弹 + squash & stretch + 装饰受扰）
      .call(() => catApi.current?.spin(), undefined, 0.08)
      .call(
        () => {
          viewRef.current = next
          setView(next)
        },
        undefined,
        0.3,
      )
  }

  // hash 驱动视图：导航点击 / 浏览器后退 / 手改 URL 都走这里
  useEffect(() => {
    const killTransition = () => {
      tlRef.current?.kill()
      gsap.set(contentRef.current, { clearProps: 'filter,visibility,opacity' })
      animating.current = false
      pendingAnchor.current = null
    }
    const onHash = () => {
      const hash = window.location.hash.slice(1)
      const next: View = hash === 'recent' ? 'recent' : 'home'
      if (next === viewRef.current) {
        // 视图已与 hash 一致（如转场中按了后退）：掐掉进行中的转场，保持状态与 URL 同步
        if (animating.current) killTransition()
        return
      }
      transitionTo(next, hash === 'recent' || hash === '' || hash === 'top' ? 'top' : hash)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 内容切换后的入场：清除旧态模糊 → 锚点滚动 → 新内容按块错峰 blur-in
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const changed = prevView.current !== view
    prevView.current = view

    gsap.set(el, { clearProps: 'filter,visibility,opacity' })

    if (pendingAnchor.current) {
      const anchor = pendingAnchor.current
      pendingAnchor.current = null
      const reduce = window.matchMedia(REDUCE_MQ).matches
      if (anchor === 'top') window.scrollTo(0, 0)
      else
        document
          .getElementById(anchor)
          ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    }

    // 首屏交给 Reveal / 标题自身入场，不叠加转场
    if (!changed) return
    if (window.matchMedia(REDUCE_MQ).matches) return

    const blocks = Array.from(el.querySelectorAll<HTMLElement>('[data-tz]'))
    if (!blocks.length) return
    const tween = gsap.fromTo(
      blocks,
      { filter: 'blur(8px)', autoAlpha: 0 },
      {
        filter: 'blur(0px)',
        autoAlpha: 1,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
        clearProps: 'filter,visibility,opacity',
      },
    )
    return () => {
      tween.kill()
    }
  }, [view])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 背景极光场：光斑游动 + 滚动视差（深色=极光 / 浅色=马卡龙） */}
      <div className="blob-par" data-parallax="-0.045" aria-hidden>
        <div className="blob blob-1" />
      </div>
      <div className="blob-par" data-parallax="-0.07" aria-hidden>
        <div className="blob blob-2" />
      </div>
      <div className="blob-par" data-parallax="-0.1" aria-hidden>
        <div className="blob blob-3" />
      </div>
      <div className="blob-par" data-parallax="-0.06" aria-hidden>
        <div className="blob blob-4" />
      </div>

      {/* 上升微光尘埃（满配 24 颗） */}
      <div className="dust" aria-hidden>
        {dust.map((d, i) => (
          <i
            key={i}
            style={
              {
                left: d.left,
                '--d': `${d.d}s`,
                '--delay': `${d.delay}s`,
                '--sway': `${d.sway}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <ScrollProgress />
      <Nav />
      <main>
        {/* 首屏双栏：左半屏内容随视图切换，右半屏猫徽章常驻（recent 视图下 sticky） */}
        <section id="top" className="layer-content px-6 pb-16 pt-14 md:pb-24 md:pt-24">
          <div
            className={`mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.15fr_0.85fr] ${
              view === 'recent' ? 'lg:items-start' : 'items-center'
            }`}
          >
            <div ref={contentRef} key={view}>
              {view === 'home' ? (
                <HeroLeft publicRepos={publicRepos} repos={repos} />
              ) : (
                <RecentLeft />
              )}
            </div>

            <Reveal
              delay={150}
              className={view === 'recent' ? 'lg:sticky lg:top-24 lg:self-start' : undefined}
            >
              <CatCard ref={catApi} />
            </Reveal>
          </div>
        </section>

        {view === 'home' && (
          <>
            <Projects repoCount={publicRepos} />
            <Toolbox />
            <About />
          </>
        )}
      </main>
      <Footer live={live} />
      {/* followers 目前未上界面，保留引用避免 hook 字段悬空 */}
      <span className="hidden">{followers}</span>
    </div>
  )
}
