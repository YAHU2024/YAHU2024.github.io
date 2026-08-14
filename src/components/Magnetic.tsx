import { useRef, type ReactNode, type PointerEvent } from 'react'

interface MagneticProps {
  children: ReactNode
  /** 最大吸附位移（px） */
  strength?: number
  className?: string
}

/**
 * 磁性容器：指针靠近时内容被轻微吸附，离开后弹簧回位。
 * reduced-motion 或触屏（无精细指针）下自动禁用。
 */
export default function Magnetic({ children, strength = 8, className = '' }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null)

  const enabled = () =>
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches &&
    window.matchMedia('(pointer: fine)').matches

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !enabled()) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    el.style.transition = 'transform 0.1s ease-out'
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`
  }

  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' // spring
    el.style.transform = 'translate(0, 0)'
  }

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={className}>
      {children}
    </div>
  )
}
