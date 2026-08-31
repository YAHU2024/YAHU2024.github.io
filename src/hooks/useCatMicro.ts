import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import { CAT_GEO } from '@/components/CatFace'

/**
 * 猫脸微表情驱动：眨眼 / 视线跟随 / 耳朵抖动 / 瞳孔放大 / 头部微倾
 * 所有效果都挂在 data-* 锚点上，改 SVG 结构时只要保留锚点即可
 */

export interface CatMicroConfig {
  /** 随机自然眨眼（含偶尔连眨两下） */
  blink: boolean
  /** 瞳孔跟随鼠标（全窗口，含距离饱和） */
  follow: boolean
  /** 耳朵偶尔抖动 */
  earTwitch: boolean
  /** 鼠标进入头像时瞳孔放大 */
  pupilDilate: boolean
  /** 整颗头随鼠标方向轻微倾斜 */
  headTilt: boolean
}

/** 默认开关：想关掉某一项在这里置 false 即可 */
export const CAT_MICRO: CatMicroConfig = {
  blink: true,
  follow: true,
  earTwitch: true,
  pupilDilate: true,
  headTilt: true,
}

// ── 可调参数（单位：SVG 用户单位，1 单位 = 1.5 CSS 像素）──
const { eye, viewBox } = CAT_GEO
/** 单片眼睑高度：覆盖半只眼 */
const LID_H = eye.ry + 1
/** 上/下眼睑完全睁开时的位移 */
const OPEN_TOP = -LID_H
const OPEN_BOTTOM = LID_H
/** 瞳孔最大偏移（眼白 rx17/ry19、瞳孔 r8.2 → 可用空间 8.8/10.8，取中小幅度） */
const PUPIL_MAX_X = 5.4
const PUPIL_MAX_Y = 4.0
/** 距离饱和系数：距头像中心约 1.15 个宽度时偏移达到上限 */
const REACH_RATIO = 1.15
/** 瞌睡（深色主题）时的开合度与视线幅度折扣 */
const DROWSY_OPEN = 0.22
const DROWSY_GAZE = 0.45
/** 头部微倾上限（度 / 单位） */
const TILT_ROT = 2.2
const TILT_X = 1.8
const TILT_Y = 1.2

/** 眨眼节奏（毫秒）：基础值 + 随机抖动 */
const BLINK_BASE = 2600
const BLINK_JITTER = 3000
const BLINK_BASE_DROWSY = 4500
const BLINK_JITTER_DROWSY = 4000
/** 连眨概率 */
const DOUBLE_BLINK_CHANCE = 0.18
/** 耳朵抖动间隔（毫秒） */
const EAR_BASE = 6500
const EAR_JITTER = 9000

/** 双眼在 viewBox 中的比例坐标，用于把鼠标位置换算成每只眼的视线方向 */
const EYE_FRAC = (['left', 'right'] as const).map((side) => ({
  x: eye[side].cx / viewBox.w,
  y: eye[side].cy / viewBox.h,
}))

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function collect(root: HTMLElement) {
  return {
    lidTops: gsap.utils.toArray<SVGGElement>(root.querySelectorAll('[data-lid="top"]')),
    lidBottoms: gsap.utils.toArray<SVGGElement>(root.querySelectorAll('[data-lid="bottom"]')),
    pupils: gsap.utils.toArray<SVGGElement>(root.querySelectorAll('[data-pupil]')),
    ears: gsap.utils.toArray<SVGGElement>(root.querySelectorAll('[data-ear]')),
    head: root.querySelector<SVGGElement>('[data-head]'),
  }
}

export interface CatMicroOptions {
  /** 暂停：拖拽 / 翻转期间冻结全部微表情，避免与 3D 旋转打架 */
  paused?: boolean
  /** 瞌睡：深色主题下眯眼、少眨眼、视线幅度减半 */
  drowsy?: boolean
  config?: Partial<CatMicroConfig>
}

/**
 * @param rootRef 挂载猫脸的容器（.badge-ava），用于测量与命中测试
 */
export function useCatMicro(
  rootRef: RefObject<HTMLElement | null>,
  { paused = false, drowsy = false, config }: CatMicroOptions = {},
) {
  const cfgRef = useRef<CatMicroConfig>({ ...CAT_MICRO, ...config })
  const pausedRef = useRef(paused)
  const drowsyRef = useRef(drowsy)
  /** 当前"睁眼程度"：1 = 全睁，DROWSY_OPEN = 眯眼，0 = 闭合 */
  const opennessRef = useRef(1)
  /**
   * 缓存可复用 quickTo 实例（瞳孔 x/y、头部 rotation/x/y）。
   * 暂停复位时须用 quickTo 自身归零，不能用 gsap.to(overwrite:'auto')——
   * 后者会杀掉正在播放的 quickTo 可复用 tween，导致恢复后跟随永久失效。
   */
  const qtoRef = useRef<{
    px: ((v: number) => void)[]
    py: ((v: number) => void)[]
    tiltRot: ((v: number) => void) | null
    tiltX: ((v: number) => void) | null
    tiltY: ((v: number) => void) | null
  }>({ px: [], py: [], tiltRot: null, tiltX: null, tiltY: null })

  // 开关同步到 ref：事件回调与 rAF 里读取，避免闭包读到过期值
  useEffect(() => {
    cfgRef.current = { ...CAT_MICRO, ...config }
  }, [config])

  // ── 主循环：眨眼调度 + 耳朵抖动 + 视线跟随（只挂载一次）──
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const svg = root.querySelector<SVGSVGElement>('svg[data-cat]')
    if (!svg) return
    const { lidTops, lidBottoms, pupils, ears, head } = collect(root)
    if (!lidTops.length || !lidBottoms.length || !pupils.length) return

    // 静态基线：睁眼 + 变换原点
    gsap.set(lidTops, { y: OPEN_TOP })
    gsap.set(lidBottoms, { y: OPEN_BOTTOM })
    gsap.set(pupils, { transformOrigin: '50% 50%' })
    if (head) gsap.set(head, { svgOrigin: CAT_GEO.headOrigin })
    ears.forEach((ear) => {
      const side = ear.dataset.ear === 'right' ? 'right' : 'left'
      gsap.set(ear, { svgOrigin: CAT_GEO.ear[side].origin })
    })

    if (reducedMotion()) return

    // ── 眨眼 ──
    const blink = (times: number) => {
      const tl = gsap.timeline()
      for (let i = 0; i < times; i += 1) {
        const at = i * 0.3
        tl.to(lidTops, { y: 0, duration: 0.085, ease: 'power2.in' }, at)
          .to(lidBottoms, { y: 0, duration: 0.085, ease: 'power2.in' }, at)
          .to(lidTops, { y: OPEN_TOP * opennessRef.current, duration: 0.13, ease: 'power2.out' }, at + 0.1)
          .to(lidBottoms, { y: OPEN_BOTTOM * opennessRef.current, duration: 0.13, ease: 'power2.out' }, at + 0.1)
      }
    }

    let blinkTimer = 0
    const scheduleBlink = () => {
      window.clearTimeout(blinkTimer)
      const sleepy = drowsyRef.current
      const base = sleepy ? BLINK_BASE_DROWSY : BLINK_BASE
      const jitter = sleepy ? BLINK_JITTER_DROWSY : BLINK_JITTER
      blinkTimer = window.setTimeout(() => {
        scheduleBlink()
        if (pausedRef.current || !cfgRef.current.blink) return
        // 瞌睡时更懒：约 55% 的节拍直接跳过
        if (drowsyRef.current && Math.random() < 0.55) return
        blink(Math.random() < DOUBLE_BLINK_CHANCE ? 2 : 1)
      }, base + Math.random() * jitter)
    }
    scheduleBlink()

    // ── 耳朵抖动 ──
    let earTimer = 0
    const scheduleEar = () => {
      window.clearTimeout(earTimer)
      earTimer = window.setTimeout(() => {
        scheduleEar()
        if (pausedRef.current || !cfgRef.current.earTwitch || !ears.length) return
        const ear = ears[Math.floor(Math.random() * ears.length)]
        const dir = Math.random() < 0.5 ? -1 : 1
        gsap
          .timeline()
          .to(ear, { rotation: 4 * dir, duration: 0.09, ease: 'power2.out' })
          .to(ear, { rotation: 0, duration: 0.09, ease: 'power2.in' })
          .to(ear, { rotation: 3 * dir, duration: 0.08, ease: 'power2.out' })
          .to(ear, { rotation: 0, duration: 0.28, ease: 'elastic.out(1, 0.5)' })
      }, EAR_BASE + Math.random() * EAR_JITTER)
    }
    scheduleEar()

    // ── 视线跟随（全窗口）──
    const px = pupils.map((p) => gsap.quickTo(p, 'x', { duration: 0.45, ease: 'power2.out' }))
    const py = pupils.map((p) => gsap.quickTo(p, 'y', { duration: 0.45, ease: 'power2.out' }))
    const tiltRot = head ? gsap.quickTo(head, 'rotation', { duration: 0.9, ease: 'power2.out' }) : null
    const tiltX = head ? gsap.quickTo(head, 'x', { duration: 0.9, ease: 'power2.out' }) : null
    const tiltY = head ? gsap.quickTo(head, 'y', { duration: 0.9, ease: 'power2.out' }) : null
    // 缓存可复用 tween，供"暂停时归位"调用（见下方 paused 分支）
    qtoRef.current = { px, py, tiltRot, tiltX, tiltY }

    // 缓存头像矩形，避免每帧强制布局；滚动/缩放/悬停时重新测量
    let rect = svg.getBoundingClientRect()
    const invalidate = () => {
      rect = svg.getBoundingClientRect()
    }
    const pointer = { x: 0, y: 0 }
    let raf = 0

    const apply = () => {
      const gaze = drowsyRef.current ? DROWSY_GAZE : 1
      const side = Math.min(rect.width, rect.height) || 1
      pupils.forEach((_, i) => {
        const f = EYE_FRAC[i] ?? EYE_FRAC[0]
        const dx = pointer.x - (rect.left + f.x * rect.width)
        const dy = pointer.y - (rect.top + f.y * rect.height)
        const dist = Math.hypot(dx, dy) || 1
        // 距离越近偏移越小，超过阈值后饱和，避免鼠标贴在脸上时瞳孔"贴边"
        const reach = Math.min(1, dist / (side * REACH_RATIO))
        px[i]?.((dx / dist) * PUPIL_MAX_X * reach * gaze)
        py[i]?.((dy / dist) * PUPIL_MAX_Y * reach * gaze)
      })
      if (tiltRot && tiltX && tiltY && cfgRef.current.headTilt) {
        const kx = gsap.utils.clamp(-1, 1, (pointer.x - (rect.left + rect.width / 2)) / (side * 2.2))
        const ky = gsap.utils.clamp(-1, 1, (pointer.y - (rect.top + rect.height / 2)) / (side * 2.2))
        tiltRot(kx * TILT_ROT)
        tiltX(kx * TILT_X)
        tiltY(ky * TILT_Y)
      }
    }

    const onMove = (e: MouseEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (pausedRef.current || !cfgRef.current.follow) return
        apply()
      })
    }

    const onEnter = () => {
      invalidate()
      if (!cfgRef.current.pupilDilate) return
      gsap.to(pupils, { scale: 1.14, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
    }
    const onLeave = () => {
      gsap.to(pupils, { scale: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('scroll', invalidate, { passive: true })
    window.addEventListener('resize', invalidate)
    root.addEventListener('mouseenter', onEnter)
    root.addEventListener('mouseleave', onLeave)

    return () => {
      window.clearTimeout(blinkTimer)
      window.clearTimeout(earTimer)
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', invalidate)
      window.removeEventListener('resize', invalidate)
      root.removeEventListener('mouseenter', onEnter)
      root.removeEventListener('mouseleave', onLeave)
      gsap.killTweensOf([...lidTops, ...lidBottoms, ...pupils, ...ears])
      if (head) gsap.killTweensOf(head)
    }
  }, [rootRef])

  // ── 暂停：拖拽 / 翻转期间回到"睁眼 + 正视"，冻结所有微表情 ──
  useEffect(() => {
    pausedRef.current = paused
    if (!paused) return
    const root = rootRef.current
    if (!root) return
    const { lidTops, lidBottoms, pupils, ears, head } = collect(root)
    if (!lidTops.length) return
    const target = opennessRef.current
    gsap.to(lidTops, { y: OPEN_TOP * target, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
    gsap.to(lidBottoms, { y: OPEN_BOTTOM * target, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
    // 瞳孔/头部用 quickTo 自身归位：避免 overwrite 杀掉可复用 tween 导致恢复后失效
    const { px, py, tiltRot, tiltX, tiltY } = qtoRef.current
    pupils.forEach((_, i) => {
      px[i]?.(0)
      py[i]?.(0)
    })
    gsap.to(ears, { rotation: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
    if (head) {
      tiltRot?.(0)
      tiltX?.(0)
      tiltY?.(0)
    }
  }, [paused, rootRef])

  // ── 瞌睡：深色主题眯眼，切回浅色睁开 ──
  useEffect(() => {
    drowsyRef.current = drowsy
    const root = rootRef.current
    if (!root) return
    const { lidTops, lidBottoms } = collect(root)
    if (!lidTops.length) return
    opennessRef.current = drowsy ? DROWSY_OPEN : 1
    const y = { top: OPEN_TOP * opennessRef.current, bottom: OPEN_BOTTOM * opennessRef.current }
    if (reducedMotion()) {
      gsap.set(lidTops, { y: y.top })
      gsap.set(lidBottoms, { y: y.bottom })
      return
    }
    gsap.to(lidTops, { y: y.top, duration: drowsy ? 0.9 : 0.5, ease: 'power2.inOut', overwrite: 'auto' })
    gsap.to(lidBottoms, { y: y.bottom, duration: drowsy ? 0.9 : 0.5, ease: 'power2.inOut', overwrite: 'auto' })
  }, [drowsy, rootRef])
}
