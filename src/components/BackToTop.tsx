import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useTheme } from '@/hooks/useTheme'

/** 回顶阈值：向下滚动超过一屏（视口高度）才显示 */
const SHOW_THRESHOLD = () =>
  typeof window !== 'undefined' ? window.innerHeight : 0

/** 水晶牌回顶按钮：右下角小徽章内嵌矢量猫
 *  - 滚动超一屏淡入上浮，回到顶部淡出
 *  - 悬停小猫抬爪 + 瞳孔放大；点击眯眼后原生平滑回顶
 *  - 尊重 prefers-reduced-motion；触屏(hover:none)关闭抬爪
 */
export default function BackToTop() {
  const [theme] = useTheme()
  const btnRef = useRef<HTMLButtonElement>(null)
  const pawRef = useRef<SVGGElement>(null)
  const eyeRef = useRef<SVGGElement>(null)
  const visibleRef = useRef(false)
  const pawRaisedRef = useRef(false)

  // ── 滚动监听：显示 / 隐藏 ──
  useEffect(() => {
    const btn = btnRef.current
    if (!btn) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 初始隐藏（autoAlpha:0 → visibility:hidden，不接收事件）
    gsap.set(btn, { autoAlpha: 0, y: 16, scale: 0.9 })

    const onScroll = () => {
      const show = window.scrollY > SHOW_THRESHOLD()
      if (show === visibleRef.current) return
      visibleRef.current = show
      // 只用 autoAlpha（opacity+visibility）：显示态 visibility:visible 可点，
      // 隐藏态 visibility:hidden 不可点也不挡事件，无需再动 pointer-events
      if (reduced) {
        gsap.set(btn, { autoAlpha: show ? 1 : 0 })
        return
      }
      if (show) {
        gsap.to(btn, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.35,
          ease: 'power2.out',
        })
      } else {
        gsap.to(btn, {
          autoAlpha: 0,
          y: 16,
          scale: 0.9,
          duration: 0.3,
          ease: 'power2.in',
        })
      }
    }
    // 监听 window 滚动 + 窗口尺寸变化（innerHeight 变则阈值变）
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // ── 回顶 ──
  const scrollTop = () => {
    const btn = btnRef.current
    if (btn) {
      const paw = pawRef.current
      if (paw && !pawRaisedRef.current) {
        // 点击眯眼（若悬停已抬爪则保留抬爪）
        gsap.timeline()
          .to(eyeRef.current, { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.18, ease: 'power2.out' })
          .to(eyeRef.current, { scaleY: 1, duration: 0.22, ease: 'power2.out', delay: 0.4 })
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── 悬停：抬爪 + 瞳孔放大（桌面端） ──
  useEffect(() => {
    const btn = btnRef.current
    const paw = pawRef.current
    const eyes = eyeRef.current
    if (!btn || !paw || !eyes) return
    if (window.matchMedia('(hover: none)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onEnter = () => {
      if (pawRaisedRef.current) return
      pawRaisedRef.current = true
      gsap.to(paw, { rotation: -22, duration: 0.28, ease: 'back.out(2.2)' })
      gsap.to(eyes, { scale: 1.12, transformOrigin: '50% 50%', duration: 0.3, ease: 'power2.out' })
    }
    const onLeave = () => {
      if (!pawRaisedRef.current) return
      pawRaisedRef.current = false
      gsap.to(paw, { rotation: 0, duration: 0.3, ease: 'power2.inOut' })
      gsap.to(eyes, { scale: 1, duration: 0.3, ease: 'power2.inOut' })
    }
    btn.addEventListener('mouseenter', onEnter)
    btn.addEventListener('mouseleave', onLeave)
    btn.addEventListener('focus', onEnter)
    btn.addEventListener('blur', onLeave)
    return () => {
      btn.removeEventListener('mouseenter', onEnter)
      btn.removeEventListener('mouseleave', onLeave)
      btn.removeEventListener('focus', onEnter)
      btn.removeEventListener('blur', onLeave)
    }
  }, [])

  // 猫色板
  const dark = theme === 'dark'
  const fur = dark ? '#1a1f2e' : '#2f2f3a'
  const furEdge = dark ? '#0b0e17' : '#20202a'
  const innerEar = dark ? '#7f9ad6' : '#ff9db0'
  const sclera = dark ? '#dfb03c' : '#f3c33f'
  const pupil = dark ? '#070a11' : '#131320'

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={scrollTop}
      className="bt-top"
      aria-label="回到顶部"
      tabIndex={0}
    >
      <svg
        className="bt-top-cat"
        viewBox="0 0 100 100"
        role="img"
        aria-hidden
        focusable="false"
      >
        {/* 耳 */}
        <path d="M 20,50 Q 22,26 30,16 Q 40,22 46,38 Z" fill={fur} stroke={furEdge} strokeWidth={2} strokeLinejoin="round" />
        <path d="M 80,50 Q 78,26 70,16 Q 60,22 54,38 Z" fill={fur} stroke={furEdge} strokeWidth={2} strokeLinejoin="round" />
        {/* 内耳 */}
        <path d="M 27,44 Q 27,30 31,24 Q 37,28 40,38 Z" fill={innerEar} opacity={0.85} />
        <path d="M 73,44 Q 73,30 69,24 Q 63,28 60,38 Z" fill={innerEar} opacity={0.85} />
        {/* 头 */}
        <ellipse cx={50} cy={56} rx={34} ry={30} fill={fur} stroke={furEdge} strokeWidth={2} />
        {/* 左眼（固定） */}
        <g>
          <ellipse cx={38} cy={52} rx={9} ry={10} fill={sclera} stroke={furEdge} strokeWidth={1.4} />
          <ellipse cx={38} cy={52} rx={4} ry={5} fill={pupil} />
        </g>
        {/* 右眼组（可抬瞳/眯眼） */}
        <g ref={eyeRef} data-bt-eye>
          <ellipse cx={62} cy={52} rx={9} ry={10} fill={sclera} stroke={furEdge} strokeWidth={1.4} />
          <ellipse cx={62} cy={52} rx={4} ry={5} fill={pupil} />
        </g>
        {/* 鼻 + 嘴 */}
        <path d="M 50,62 L 54,67 Q 50,70 46,67 Z" fill={innerEar} />
        <g fill="none" stroke={dark ? 'rgba(205,225,255,0.42)' : 'rgba(255,255,255,0.6)'} strokeWidth={1.4} strokeLinecap="round">
          <path d="M 50,69 Q 50,74 44,72" />
          <path d="M 50,69 Q 50,74 56,72" />
        </g>
        {/* 胡须 */}
        <g fill="none" stroke={dark ? 'rgba(160,190,255,0.3)' : 'rgba(255,255,255,0.42)'} strokeWidth={1.1} strokeLinecap="round">
          <path d="M 30,60 Q 19,57 12,54" />
          <path d="M 29,65 Q 19,66 11,67" />
          <path d="M 70,60 Q 81,57 88,54" />
          <path d="M 71,65 Q 81,66 89,67" />
        </g>
        {/* 右爪（可抬，绕右下腕部旋转） */}
        <g ref={pawRef} data-bt-paw style={{ transformOrigin: '70px 82px' }}>
          <path d="M 58,78 Q 66,88 78,86 Q 82,84 80,79 Q 74,74 66,74 Z" fill={fur} stroke={furEdge} strokeWidth={2} strokeLinejoin="round" />
        </g>
      </svg>
      {/* 微弱光圈提示 */}
      <span className="bt-top-ring" aria-hidden />
    </button>
  )
}
