import { useEffect } from 'react'

/**
 * 滚动视差：让标记了 data-parallax 的背景层随滚动轻微位移（系数越小层越"远"）。
 * rAF 节流 + transform 合成，reduced-motion 下不启用。
 */
export function useScrollParallax() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'))
    if (!els.length) return

    let ticking = false
    const update = () => {
      ticking = false
      const y = window.scrollY
      for (const el of els) {
        const depth = Number(el.dataset.parallax ?? 0)
        el.style.transform = `translate3d(0, ${(y * depth).toFixed(1)}px, 0)`
      }
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}
