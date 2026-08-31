import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface RevealProps {
  children: ReactNode
  /** 入场延迟（毫秒），网格错峰用 */
  delay?: number
  className?: string
}

/**
 * 进入视口揭示动画（GSAP + ScrollTrigger）：
 * - 淡入 + 轻微缩放 + 上移，back.out 弹性收尾
 * - once:true 只播一次，不随滚动反向回放
 * - prefers-reduced-motion 下直接渲染最终态；无 JS 时内容同样可见
 */
export default function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.96, y: 16 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.45,
          delay: delay / 1000,
          ease: 'back.out(1.4)',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        },
      )
    })
    return () => ctx.revert()
  }, [delay])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
