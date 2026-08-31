import { useEffect } from 'react'
import type { RefObject } from 'react'

interface TiltTargets {
  /** 外层容器：运动期挂 .is-moving（关闭 backdrop-filter，避免每帧重采样） */
  root: RefObject<HTMLElement | null>
  /** 3D 运动层：写入 rotateX / rotateY */
  target: RefObject<HTMLElement | null>
}

interface TiltOptions {
  enabled?: boolean
  /** 最大倾角（度）；±maxTilt 由指针位置插值 */
  maxTilt?: number
}

const LERP = 0.18 // 惯性系数：值越小越"粘滞"
const EPS = 0.04 // 角度收敛阈值

/**
 * 3D 微倾斜：指针移动时卡片绕 X/Y 轴跟手倾转，松手平滑回正。
 * - rAF 单帧合并 + lerp 惯性，只写 transform（合成器友好）
 * - 运动期给 root 挂 .is-moving 关 backdrop-filter
 * - prefers-reduced-motion / pointer:coarse（触屏）下不启用
 */
export function useTilt(
  { root, target }: TiltTargets,
  { enabled = false, maxTilt = 6 }: TiltOptions = {},
) {
  useEffect(() => {
    const el = target.current
    const rootEl = root.current
    if (!el || !rootEl || !enabled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    let raf = 0
    let tRX = 0
    let tRY = 0
    let cRX = 0
    let cRY = 0

    const tick = () => {
      raf = 0
      cRX += (tRX - cRX) * LERP
      cRY += (tRY - cRY) * LERP
      el.style.transform = `rotateX(${cRX.toFixed(2)}deg) rotateY(${cRY.toFixed(2)}deg)`
      if (Math.abs(tRX - cRX) > EPS || Math.abs(tRY - cRY) > EPS) {
        raf = requestAnimationFrame(tick)
      } else {
        // 收敛即归零：lerp 永不精确到 0，直接清 transform + 恢复 backdrop-filter
        cRX = cRY = 0
        el.style.transform = ''
        rootEl.classList.remove('is-moving')
      }
    }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      tRY = (x - 0.5) * 2 * maxTilt
      tRX = -(y - 0.5) * 2 * maxTilt
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onEnter = () => rootEl.classList.add('is-moving')
    const onLeave = () => {
      tRX = tRY = 0
      if (!raf) raf = requestAnimationFrame(tick)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
      el.style.transform = ''
      rootEl.classList.remove('is-moving')
    }
  }, [enabled, maxTilt, root, target])
}
