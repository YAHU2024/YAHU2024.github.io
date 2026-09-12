import { useRef } from 'react'
import gsap from 'gsap'
import { useLocale, useT } from '@/hooks/useLocale'

/** 中英语言开关：样式对齐 ThemeToggle；钮面显示目标语言（中文态显示 EN，英文态显示 中）。
    点击动效：标签沿 Y 轴翻牌，语言状态在翻转中点（侧对观众、不可见）切换 */
export default function LangToggle() {
  const [locale, setLocale] = useLocale()
  const t = useT()
  const labelRef = useRef<HTMLSpanElement>(null)
  const next = locale === 'zh' ? 'en' : 'zh'

  const flip = () => {
    const el = labelRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLocale(next)
      return
    }
    gsap.killTweensOf(el)
    gsap.set(el, { rotationY: 0, transformPerspective: 120 })
    gsap
      .timeline()
      .to(el, { rotationY: 90, duration: 0.15, ease: 'power2.in' })
      // 中点切状态：此刻标签侧对观众（90° 不可见），换字无感
      .call(() => setLocale(next))
      .set(el, { rotationY: -90 })
      .to(el, { rotationY: 0, duration: 0.32, ease: 'back.out(1.6)' })
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={t.lang.toggleAria}
      title={t.lang.toggleTitle}
      className="toggle-pop glass flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full px-2 text-xs font-extrabold tracking-wide text-foreground/80 hover:text-foreground"
    >
      <span ref={labelRef} className="flex">
        {next === 'en' ? 'EN' : '中'}
      </span>
    </button>
  )
}
