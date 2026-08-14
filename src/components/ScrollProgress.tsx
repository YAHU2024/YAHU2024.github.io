import { useEffect, useRef, useState } from 'react'

/** 顶部 2px 滚动进度条（rAF 节流） */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0)
  const ticking = useRef(false)

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        setProgress(max > 0 ? window.scrollY / max : 0)
        ticking.current = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      aria-hidden
      className="fixed left-0 top-0 z-[60] h-0.5 bg-accent transition-[width] duration-100 ease-out"
      style={{ width: `${progress * 100}%` }}
    />
  )
}
