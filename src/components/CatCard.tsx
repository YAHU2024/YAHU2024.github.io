import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent, KeyboardEvent as RKeyboardEvent } from 'react'
import gsap from 'gsap'
import { profile } from '@/data/github'
import { copy } from '@/data/copy'
import { useTheme } from '@/hooks/useTheme'
import CatFace from '@/components/CatFace'
import { useCatMicro } from '@/hooks/useCatMicro'

// 真 3D 侧壁：用 N 段薄片绕圆周拼成亚克力筒（半径=徽章半径，高度=厚度）
const EDGES = 72 // 段数越多轮廓越圆（弦长 2πR/N ≈ 14.8px）
const EDGE_STEP = 360 / EDGES
// 以下均为「基准直径 340px」下的取值。窄屏时 .badge 会收缩到容器宽度，
// 侧壁/装饰按实际直径等比换算（scale = 实测直径 / BASE_D），否则侧壁会飞出圆外。
const BASE_D = 340
const BASE_EDGE_R = 170 // 徽章半径（340/2）
const BASE_EDGE_W = 17 // 单段切向宽（> 弦长，保证接缝重叠无漏缝）
const BASE_EDGE_T = 28 // 侧壁厚度（直径:厚度 ≈ 12:1，薄玻璃水晶牌）

// 亚克力水晶牌色板：周向打光后在 JS 内算色并内联注入
// 注意：不能用 filter: brightness()，filter 会强制 flatten 掉 preserve-3d 的 3D 定位
const ACRYLIC = {
  light: {
    hi2: '#fff6f0', // 前沿折射高光线（最亮）
    hi: '#ffb59c', // 高光过渡
    body: 'rgba(240, 101, 60, 0.4)', // 玻璃本体（半透，背景可透出）
    mid: 'rgba(240, 101, 60, 0.58)',
    lo: '#b4482a', // 背沿深部
  },
  dark: {
    hi2: '#e8f8ff',
    hi: '#9ed9fb',
    body: 'rgba(125, 211, 252, 0.38)',
    mid: 'rgba(125, 211, 252, 0.55)',
    lo: '#2b6f8f',
  },
} as const

/** 把颜色按系数 k 向黑压暗（支持 #rrggbb 与 rgba()），保留 alpha */
function dim(color: string, k: number) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16)
    const r = Math.round(((n >> 16) & 255) * k)
    const g = Math.round(((n >> 8) & 255) * k)
    const b = Math.round((n & 255) * k)
    return `rgb(${r}, ${g}, ${b})`
  }
  const m = color.match(/rgba?\(([^)]+)\)/)
  if (!m) return color
  const [r, g, b, a] = m[1].split(',').map((s) => s.trim())
  return `rgba(${Math.round(Number(r) * k)}, ${Math.round(Number(g) * k)}, ${Math.round(
    Number(b) * k,
  )}, ${a ?? '1'})`
}

// 藏在徽章下一层、透过边缘玻璃透色的探索装饰（x/y = 相对圆心的偏移 px）
const hiddenDecos = [
  { ch: '⭐', depth: 1.2, x: 130, y: 78 },
  { ch: '🐟', depth: 0.9, x: -132, y: 70 },
  { ch: '✨', depth: 1.4, x: 6, y: -150 },
]

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Hero 右侧的互动猫徽章：
 * - 圆形亚克力水晶牌 3D 徽章：真 3D 侧壁 40px 厚 + 周向打光 + 前后倒角 + 接触投影
 * - 正面头像嵌入亚克力，背面为 slogan + 技术栈图标环
 * - 自由 X+Y 翻转：按住拖拽跟手旋转（可连续 360° 多圈），松手带惯性 elastic 归位正面
 * - 悬停微浮 + 光环呼吸（桌面端；触屏/减弱动效自动关闭）
 * - 矢量猫脸微表情（useCatMicro）：随机眨眼、瞳孔全窗口跟随、耳朵抖动、头部微倾；
 *   拖拽/翻转期间全部冻结，深色主题切换为眯眼瞌睡
 * - 探索装饰藏在徽章下一层，透过边缘玻璃隐约透色
 * - 昼夜联动：切深色猫咪打瞌睡冒 Zzz，切浅色秒醒抖毛撒星星
 * - 键盘：聚焦后 Enter/Space 翻到背面停留，再按回正面
 */
export default function CatCard() {
  const [theme] = useTheme()
  /** 亚克力色板随主题切换 */
  const palette = ACRYLIC[theme === 'dark' ? 'dark' : 'light']
  const stageRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const badgeAvaRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const flipping = useRef(false)
  const flipped = useRef(false)
  const rot = useRef({ x: 0, y: 0 })
  const last = useRef({ x: 0, y: 0 })
  const vel = useRef({ x: 0, y: 0 })
  /** 拖拽/翻转中：ref 供事件同步，state 用于驱动微表情 hook 暂停 */
  const [microPaused, setMicroPaused] = useState(false)
  /** 徽章直径相对基准（340px）的缩放比：窄屏收缩时侧壁与装饰等比跟随 */
  const [scale, setScale] = useState(1)
  const floatRef = useRef<gsap.core.Tween | null>(null)
  const rafRef = useRef(0)
  /** 徽章是否处于运动中（悬停微浮 / 翻转） */
  const moving = useRef({ hover: false, flip: false })
  /** 运动期间关闭正反面 backdrop-filter：它会每帧重采样背景，是翻转卡顿主因 */
  const syncMoving = () => {
    badgeRef.current?.classList.toggle(
      'is-moving',
      moving.current.hover || moving.current.flip,
    )
  }

  // ── 猫脸微表情：眨眼 / 视线跟随 / 耳朵抖动 / 头部微倾 ──
  useCatMicro(badgeAvaRef, { paused: microPaused, drowsy: theme === 'dark' })

  // ── 跟踪徽章实际直径 ──
  // 用 useLayoutEffect 而非 useEffect：在浏览器绘制前就完成测量，
  // 否则窄屏首帧会按基准 340px 摆放侧壁，出现一帧"侧壁飞出圆外"。
  useLayoutEffect(() => {
    const el = badgeRef.current
    if (!el) return
    const apply = (w: number) => {
      if (w > 0) setScale(w / BASE_D)
    }
    apply(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) apply(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── 悬停微浮 + 眼神跟随 + 光环呼吸（触屏/减弱动效关闭） ──
  useEffect(() => {
    const stage = stageRef.current
    const badge = badgeRef.current
    const ring = ringRef.current
    if (!stage || !badge || !ring) return
    if (reducedMotion() || window.matchMedia('(hover: none)').matches) return

    const ctx = gsap.context(() => {
      // 微浮改为「悬停才启动」：静止时徽章完全不动，backdrop-filter 结果可被缓存；
      // 否则持续位移会让浏览器每帧重新采样并模糊背景
      const startFloat = () => {
        moving.current.hover = true
        syncMoving()
        if (floatRef.current) return
        floatRef.current = gsap.to(badge, {
          y: -6,
          duration: 3,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        })
      }
      const stopFloat = () => {
        if (!floatRef.current) return
        floatRef.current.kill()
        floatRef.current = null
        gsap.to(badge, {
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          onComplete: () => {
            if (floatRef.current) return // 期间重新进入，不复位
            moving.current.hover = false
            syncMoving()
          },
        })
      }
      // 注：整张头像的位移跟随已移除——瞳孔现在会真的动，再加整图平移会变成"双重移动"
      const ro = gsap.quickTo(ring, 'opacity', { duration: 0.4 })
      const decos = gsap.utils.toArray<HTMLElement>('[data-depth]', stage)
      const decoTo = decos.map((d) => ({
        depth: Number(d.dataset.depth ?? 1),
        x: gsap.quickTo(d, 'x', { duration: 0.6, ease: 'power2.out' }),
        y: gsap.quickTo(d, 'y', { duration: 0.6, ease: 'power2.out' }),
      }))

      const onMove = (e: MouseEvent) => {
        if (flipping.current) return
        const rect = badge.getBoundingClientRect()
        const px = (e.clientX - rect.left) / rect.width - 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5
        ro(0.5 + Math.abs(px) * 0.5)
        decoTo.forEach(({ depth, x, y }) => {
          x(px * depth * 26)
          y(py * depth * 20)
        })
      }
      const onLeave = () => {
        ro(0.3)
        decoTo.forEach(({ x, y }) => {
          x(0)
          y(0)
        })
      }
      stage.addEventListener('mousemove', onMove)
      stage.addEventListener('mouseleave', onLeave)
      stage.addEventListener('mouseenter', startFloat)
      stage.addEventListener('mouseleave', stopFloat)
      return () => {
        stage.removeEventListener('mousemove', onMove)
        stage.removeEventListener('mouseleave', onLeave)
        stage.removeEventListener('mouseenter', startFloat)
        stage.removeEventListener('mouseleave', stopFloat)
      }
    }, stage)
    return () => ctx.revert()
  }, [])

  // ── 自由 X+Y 翻转（pointer 拖拽，跟手，松手惯性归位） ──
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (flipping.current) return
    flipping.current = true
    flipped.current = false
    moving.current.flip = true
    syncMoving()
    setMicroPaused(true) // 拖拽期间冻结眨眼/视线，避免与 3D 旋转打架
    badgeRef.current?.setPointerCapture?.(e.pointerId)
    last.current = { x: e.clientX, y: e.clientY }
    gsap.killTweensOf(badgeRef.current!)
    gsap.to(badgeRef.current, { scale: 1.05, duration: 0.2, ease: 'power2.out' })
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!flipping.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    rot.current.y += dx * 0.6
    rot.current.x -= dy * 0.6
    vel.current = { x: -dy * 0.6, y: dx * 0.6 }
    // rAF 节流：高刷屏上 pointermove 可能一帧多次，合并为每帧只写一次样式
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      if (!badgeRef.current) return
      gsap.set(badgeRef.current, { rotationY: rot.current.y, rotationX: rot.current.x })
    })
  }
  const endFlip = (e: RPointerEvent<HTMLDivElement>) => {
    if (!flipping.current) return
    flipping.current = false
    badgeRef.current?.releasePointerCapture?.(e.pointerId)
    // 冲刷未落地的 rAF，避免惯性起点与手势终点不一致
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      gsap.set(badgeRef.current, { rotationY: rot.current.y, rotationX: rot.current.x })
    }
    if (reducedMotion()) {
      gsap.set(badgeRef.current, { rotationX: 0, rotationY: 0, scale: 1 })
      rot.current = { x: 0, y: 0 }
      moving.current.flip = false
      syncMoving()
      setMicroPaused(false)
      return
    }
    // 惯性：把松手前角速度折算成额外旋转余量
    rot.current.y += vel.current.y * 6
    rot.current.x += vel.current.x * 6
    gsap.to(badgeRef.current, {
      rotationY: 0,
      rotationX: 0,
      scale: 1,
      duration: 1.3,
      ease: 'elastic.out(1, 0.5)',
      onComplete: () => {
        moving.current.flip = false
        syncMoving()
        setMicroPaused(false) // 归位动画结束后再恢复微表情
      },
    })
    rot.current = { x: 0, y: 0 }
  }

  // ── 键盘翻转：翻到背面停留，再按回正面 ──
  const onKeyDown = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    flipped.current = !flipped.current
    moving.current.flip = true
    syncMoving()
    setMicroPaused(true) // 停在背面时脸朝外看不见，正面回正后再恢复
    gsap.killTweensOf(badgeRef.current!)
    gsap.to(badgeRef.current, {
      rotationY: flipped.current ? 180 : 0,
      duration: 0.8,
      ease: 'power3.inOut',
      onComplete: () => {
        moving.current.flip = false
        syncMoving()
        if (!flipped.current) setMicroPaused(false)
      },
    })
    rot.current = { x: 0, y: flipped.current ? 180 : 0 }
  }

  // ── 昼夜联动：深色打瞌睡冒 Zzz；切回浅色秒醒抖毛撒星星 ──
  const prevTheme = useRef(theme)
  useEffect(() => {
    const ava = badgeAvaRef.current
    if (!ava) return
    const reduced = reducedMotion()
    const wasDark = prevTheme.current === 'dark'
    prevTheme.current = theme

    if (theme === 'dark') {
      const z = ava.querySelectorAll<HTMLElement>('.zzz-letter')
      if (!reduced && wasDark) {
        z.forEach((letter, i) => {
          gsap.fromTo(
            letter,
            { y: 8, opacity: 0, scale: 0.5 },
            {
              keyframes: [
                { y: -12, opacity: 0.95, scale: 1, duration: 0.9 },
                { y: -30, opacity: 0, scale: 0.9, duration: 1 },
              ],
              delay: i * 0.7,
              repeat: -1,
              repeatDelay: 0.8,
              ease: 'none',
            },
          )
        })
      } else {
        gsap.set(z, { opacity: 0 })
      }
      return
    }

    const z = ava.querySelectorAll<HTMLElement>('.zzz-letter')
    gsap.killTweensOf(z)
    gsap.set(z, { opacity: 0 })
    if (!wasDark) return
    if (reduced) return

    gsap.to(ava, {
      keyframes: [
        { x: -5, duration: 0.07 },
        { x: 5, duration: 0.07 },
        { x: -3, duration: 0.07 },
        { x: 3, duration: 0.07 },
        { x: 0, duration: 0.07 },
      ],
    })
    const colors = ['✨', '⭐', '✨', '💫', '⭐', '✨']
    colors.forEach((ch, i) => {
      const star = document.createElement('span')
      star.className = 'wake-star'
      star.textContent = ch
      star.style.left = `${14 + i * 12}%`
      star.style.top = `${8 + (i % 3) * 14}%`
      star.style.fontSize = `${12 + (i % 3) * 5}px`
      ava.appendChild(star)
      gsap.fromTo(
        star,
        { scale: 0, opacity: 1, rotation: 0 },
        {
          scale: 1.25,
          opacity: 0,
          rotation: 40,
          y: -26,
          duration: 0.9,
          delay: i * 0.06,
          ease: 'power1.out',
          onComplete: () => star.remove(),
        },
      )
    })
  }, [theme])

  // 侧壁与装饰：按实测直径等比换算（scale 见上方 ResizeObserver）
  const edgeR = BASE_EDGE_R * scale
  const edgeW = BASE_EDGE_W * scale
  const edgeH = BASE_EDGE_T * scale + 1 // +1 避免与正反面共面 z-fighting

  return (
    <div ref={stageRef} className="cat-stage relative mx-auto w-full max-w-sm select-none">
      {/* 接触投影：撑起重量感（z-index 0，位于徽章之下） */}
      <div className="badge-shadow" aria-hidden />

      {/* 探索装饰：藏在徽章下一层，透过边缘玻璃隐约透色 */}
      {hiddenDecos.map((d, i) => (
        <span
          key={i}
          className="badge-hidden-deco"
          data-depth={d.depth}
          style={{
            left: `calc(50% + ${d.x * scale}px)`,
            top: `calc(50% + ${d.y * scale}px)`,
            fontSize: `calc(1.4rem * ${scale})`,
          }}
        >
          {d.ch}
        </span>
      ))}

      {/* 3D 徽章 */}
      <div
        ref={badgeRef}
        className="badge"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endFlip}
        onPointerCancel={endFlip}
        tabIndex={0}
        role="button"
        aria-label={copy.cat.badgeAria}
        onKeyDown={onKeyDown}
      >
        {/* 真 3D 侧壁：72 段拼成亚克力筒，按角度周向打光（光源左上 135°）
            渐变 0% = 后沿(z=-T/2) → 100% = 前沿(z=+T/2)，前沿处为明亮折射高光线 */}
        {Array.from({ length: EDGES }, (_, i) => {
          const rad = (i * EDGE_STEP * Math.PI) / 180
          // 圆柱受光：左上 135° 最亮 lit=1，右下最暗 lit=0.68（玻璃受光比金属柔和）
          const lit = 0.68 + 0.32 * (0.5 + 0.5 * Math.cos(rad - Math.PI * 0.75))
          const bg = `linear-gradient(180deg, ${dim(palette.lo, lit)} 0%, ${dim(
            palette.mid,
            lit,
          )} 26%, ${dim(palette.body, lit)} 62%, ${dim(palette.hi, lit)} 88%, ${dim(
            palette.hi2,
            lit,
          )} 96%, ${dim(palette.lo, lit)} 100%)`
          return (
            <span
              key={i}
              className="badge-edge"
              style={{
                width: `${edgeW}px`,
                height: `${edgeH}px`,
                marginLeft: `${-edgeW / 2}px`,
                marginTop: `${-edgeH / 2}px`,
                transform: `rotateZ(${i * EDGE_STEP}deg) translateY(${edgeR}px) rotateX(90deg)`,
                background: bg,
              }}
            />
          )
        })}

        <div className="badge-ring" ref={ringRef} aria-hidden />

        {/* 正面：头像 */}
        <div className="badge-face badge-front">
          <div ref={badgeAvaRef} className="badge-ava">
            <CatFace theme={theme} />
            {/* 打瞌睡 Zzz */}
            <span className="zzz-letter right-3 top-1 text-lg">z</span>
            <span className="zzz-letter right-7 top-2 text-xl">Z</span>
            <span className="zzz-letter right-11 top-3 text-base">z</span>
          </div>
        </div>

        {/* 背面：原图头像（替换原文字 + 工具说明） */}
        <div className="badge-face badge-back">
          <img
            className="badge-back-ava"
            src={profile.avatarUrl}
            alt={copy.cat.avatarAlt}
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}
