import { useEffect } from 'react'
import type { RefObject } from 'react'

interface SheenOptions {
  enabled?: boolean
}

const LERP = 0.22 // 光斑跟随系数（比 tilt 略快，光点更跟手）
const EPS = 0.08 // 百分比收敛阈值

/**
 * 光标光斑：高光径向渐变（.glass-sheen）跟随指针位置。
 * - 通过 CSS 变量 --sx / --sy 驱动，rAF lerp 平滑
 * - reduced-motion / 触屏下降级为静态光斑（居中 35% 透明度），悬停仍可见
 */
export function useSheen(
  ref: RefObject<HTMLElement | null>,
  { enabled = true }: SheenOptions = {},
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const sheen = el.querySelector<HTMLElement>('.glass-sheen')
    if (!sheen) return

    // 降级：静态居中光斑，hover 时由 CSS 显示
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      sheen.style.setProperty('--sx', '50%')
      sheen.style.setProperty('--sy', '30%')
      sheen.style.opacity = '.35'
      return
    }

    let raf = 0
    let tSX = 50
    let tSY = 30
    let cSX = 50
    let cSY = 30

    const tick = () => {
      raf = 0
      cSX += (tSX - cSX) * LERP
      cSY += (tSY - cSY) * LERP
      sheen.style.setProperty('--sx', cSX.toFixed(1) + '%')
      sheen.style.setProperty('--sy', cSY.toFixed(1) + '%')
      if (Math.abs(tSX - cSX) > EPS || Math.abs(tSY - cSY) > EPS) {
        raf = requestAnimationFrame(tick)
      }
    }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      tSX = ((e.clientX - r.left) / r.width) * 100
      tSY = ((e.clientY - r.top) / r.height) * 100
      if (!raf) raf = requestAnimationFrame(tick)
    }

    el.addEventListener('pointermove', onMove)
    return () => {
      el.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
      sheen.style.removeProperty('--sx')
      sheen.style.removeProperty('--sy')
      sheen.style.removeProperty('opacity')
    }
  }, [enabled, ref])
}
