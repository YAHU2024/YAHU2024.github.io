import { useImperativeHandle, useEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent, KeyboardEvent as RKeyboardEvent, Ref } from 'react'
import gsap from 'gsap'
import { profile } from '@/data/github'
import { useT } from '@/hooks/useLocale'
import { useTheme } from '@/hooks/useTheme'
import CatFace from '@/components/CatFace'
import type { CatBadgeHandle } from './CatBadge'

/**
 * 2D 平面徽章兜底：WebGL 不可用（老 iOS 微信客户端）或 context lost 恢复失败时接管。
 * - 单层平面圆（无 preserve-3d、无 3D 合成栈——这正是要绕开的缺陷族）
 * - 翻转 = 单元素 rotateY + 90° 中点换面（LangToggle 翻牌同款，微信内实测正常）
 * - 交互完整：拖拽（单轴 ry）/ 松手惯性 / 键盘翻转 / spin；无双轴翻转
 * - 头像加载失败 → accent「Y」字标圆片兜底
 */
export default function Badge2DFallback({ fwdRef }: { fwdRef?: Ref<CatBadgeHandle> }) {
  const t = useT()
  const [theme] = useTheme()
  const innerRef = useRef<HTMLDivElement>(null)
  const [face, setFace] = useState<'front' | 'back'>('front')
  const faceRef = useRef<'front' | 'back'>('front')
  const [imgFailed, setImgFailed] = useState(false)
  const dragging = useRef(false)
  const last = useRef({ x: 0 })
  const vel = useRef(0)
  const rafRef = useRef(0)
  const spinTl = useRef<gsap.core.Timeline | null>(null)

  // 翻转吃透视：.badge2d-inner 是 .cat-stage 三级后代，stage 的 perspective 属性
  // 传不到这里（只作用于直接子元素），必须经 GSAP transformPerspective 写进自身矩阵
  useEffect(() => {
    if (innerRef.current) gsap.set(innerRef.current, { transformPerspective: 1000 })
  }, [])

  const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /** ry 归一化到 [0,360)，>90 且 <270 为背面朝前 */
  const syncFace = (ry: number) => {
    const norm = ((ry % 360) + 360) % 360
    const want: 'front' | 'back' = norm > 90 && norm < 270 ? 'back' : 'front'
    if (faceRef.current !== want) {
      faceRef.current = want
      setFace(want)
    }
  }

  const applyRy = (ry: number) => {
    gsap.set(innerRef.current, { rotationY: ry })
    syncFace(ry)
  }

  // ── 键盘 / 点击兜底翻转：90° 中点换面（power3.inOut 对称，中点侧对观众时换内容）──
  const toggleFlip = () => {
    const el = innerRef.current
    if (!el || dragging.current) return
    const toBack = faceRef.current === 'front'
    if (reducedMotion()) {
      applyRy(toBack ? 180 : 0)
      return
    }
    gsap.killTweensOf(el)
    gsap
      .timeline()
      .to(el, { rotationY: 90, duration: 0.3, ease: 'power2.in', onUpdate: syncFaceFromEl })
      .call(() => {
        faceRef.current = toBack ? 'back' : 'front'
        setFace(faceRef.current)
        gsap.set(el, { rotationY: toBack ? -90 : 90 })
      })
      .to(el, { rotationY: toBack ? 180 : 0, duration: 0.5, ease: 'power2.out', onUpdate: syncFaceFromEl })
  }
  const syncFaceFromEl = () => {
    const el = innerRef.current
    if (el) syncFace(Number(gsap.getProperty(el, 'rotationY')))
  }

  // ── 拖拽：单轴 ry，松手惯性后吸附到最近的 0/180 ──
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    dragging.current = true
    const el = innerRef.current
    el?.setPointerCapture?.(e.pointerId)
    gsap.killTweensOf(el)
    last.current = { x: e.clientX }
    vel.current = 0
    gsap.to(el, { scale: 1.05, duration: 0.2, ease: 'power2.out' })
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const dx = e.clientX - last.current.x
    last.current = { x: e.clientX }
    vel.current = dx * 0.6
    const el = innerRef.current
    if (!el) return
    const ry = Number(gsap.getProperty(el, 'rotationY')) + dx * 0.6
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      applyRy(ry)
    })
  }
  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    innerRef.current?.releasePointerCapture?.(e.pointerId)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    const el = innerRef.current
    if (!el) return
    if (reducedMotion()) {
      applyRy(faceRef.current === 'back' ? 180 : 0)
      gsap.set(el, { scale: 1 })
      return
    }
    const ry = Number(gsap.getProperty(el, 'rotationY')) + vel.current * 6
    const target = Math.round(ry / 180) * 180
    gsap.to(el, {
      rotationY: target,
      scale: 1,
      duration: 1.1,
      ease: 'elastic.out(1, 0.5)',
      onUpdate: syncFaceFromEl,
    })
  }

  // ── spin：ry += 360 back.out + 均匀缩放（2D 安全）──
  const spin = () => {
    const el = innerRef.current
    if (!el || reducedMotion()) return
    spinTl.current?.kill()
    gsap.killTweensOf(el)
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(el, { rotationY: 0, scale: 1 })
        syncFace(0)
      },
    })
    spinTl.current = tl
    tl.to(el, {
      rotationY: `+=360`,
      duration: 1.0,
      ease: 'back.out(1.2)',
      onUpdate: syncFaceFromEl,
    })
    tl.to(el, { scale: 1.05, duration: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0)
  }

  useImperativeHandle(fwdRef, () => ({ spin }), [])

  const onKeyDown = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    toggleFlip()
  }

  return (
    <div
      className="badge2d"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      tabIndex={0}
      role="button"
      aria-label={t.cat.badgeAria}
      onKeyDown={onKeyDown}
    >
      <div ref={innerRef} className="badge2d-inner">
        <div className="badge2d-face">
          {face === 'front' ? (
            <CatFace theme={theme} />
          ) : imgFailed ? (
            <span className="badge2d-y" aria-hidden>
              Y
            </span>
          ) : (
            <img
              className="badge2d-ava"
              src={profile.avatarUrl}
              alt={t.cat.avatarAlt}
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
