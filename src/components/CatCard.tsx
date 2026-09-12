import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent, KeyboardEvent as RKeyboardEvent, Ref } from 'react'
import gsap from 'gsap'
import { profile } from '@/data/github'
import { useT } from '@/hooks/useLocale'
import { useTheme } from '@/hooks/useTheme'
import CatFace from '@/components/CatFace'
import { useCatMicro } from '@/hooks/useCatMicro'

// 真 3D 侧壁 v2：N 个真圆沿 Z 轴阶梯叠出厚度。
// 旧方案（72 段直边薄片绕圆周拼筒）轮廓是 72 边形，Chromium 对 3D 层不做抗锯齿，
// 正面看边缘有微小锯齿；真圆叠层轮廓 = 原生抗锯齿圆，锯齿从几何上消除。
const LAYERS = 42 // 层距 = 厚度/LAYERS ≈ 0.65px（基准 340px 下）+ 每层 1.1px 同色描边封缝，翻转时侧壁连续无漏缝
const FILLET_LAYERS = 9 // 每侧参与圆角倒角的层数（42 层中占 9 层，随层数等比扩）
const FILLET_AMT = 0.018 // 表面圆角收缩比（抵消 1.1px 描边外扩，正面直径不变），正反面同步缩小保持轮廓连续
// 以下均为「基准直径 340px」下的取值。窄屏时 .badge 会收缩到容器宽度，
// 侧壁/装饰按实际直径等比换算（scale = 实测直径 / BASE_D），否则侧壁会飞出圆外。
const BASE_D = 340
const BASE_EDGE_R = 170 // 徽章半径（340/2）
const BASE_EDGE_T = 28 // 侧壁厚度（直径:厚度 ≈ 12:1，薄玻璃水晶牌）

// 亚克力水晶牌色板：叠层侧壁在 JS 内沿层深连续插值（三锚点，无离散色带）
// 侧壁随主题呼应正面：浅色=暖白玻璃 / 深色=黑灰玻璃，保留微透（alpha 0.78~0.95）
// 注意：不能用 filter: brightness()，filter 会强制 flatten 掉 preserve-3d 的 3D 定位
type RGBA = [number, number, number, number]
const ACRYLIC = {
  light: {
    mid: [201, 191, 177, 0.9] as RGBA, // 背沿暖灰（背光面，与前沿拉开明度差才有立体感）
    hi: [236, 230, 221, 0.93] as RGBA, // 高光过渡
    hi2: [255, 255, 255, 0.96] as RGBA, // 前沿受光高光
  },
  dark: {
    mid: [13, 17, 27, 0.82] as RGBA, // 背沿黑灰（呼应正面深色面板）
    hi: [54, 62, 76, 0.88] as RGBA, // 高光过渡
    hi2: [128, 138, 154, 0.92] as RGBA, // 前沿受光灰
  },
} as const

/** RGBA 两色线性插值，k ∈ [0,1] */
function mixColor(a: RGBA, b: RGBA, k: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
    +(a[3] + (b[3] - a[3]) * k).toFixed(3),
  ]
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
 * - 圆形亚克力水晶牌 3D 徽章：真 3D 侧壁（真圆叠层 28px 厚）+ 层深打光 + 前后倒角 + 接触投影
 * - 正面头像嵌入亚克力，背面为 slogan + 技术栈图标环
 * - 自由 X+Y 翻转：按住拖拽跟手旋转（可连续 360° 多圈），松手带惯性 elastic 归位正面
 * - 悬停微浮 + 光环呼吸（桌面端；触屏/减弱动效自动关闭）
 * - 矢量猫脸微表情（useCatMicro）：随机眨眼、瞳孔全窗口跟随、耳朵抖动、头部微倾；
 *   拖拽/翻转期间全部冻结，深色主题切换为眯眼瞌睡
 * - 探索装饰藏在徽章下一层，透过边缘玻璃隐约透色
 * - 昼夜联动：切深色猫咪打瞌睡冒 Zzz，切浅色秒醒抖毛撒星星
 * - 键盘：聚焦后 Enter/Space 翻到背面停留，再按回正面
 */
/** 对外暴露的命令句柄：Home 在视图切换转场时调用 spin() */
export interface CatCardHandle {
  /** 整圈物理旋转：back.out 回弹 + squash & stretch，装饰/投影不随转而受扰 */
  spin: () => void
}

interface CatCardProps {
  ref?: Ref<CatCardHandle>
}

export default function CatCard({ ref }: CatCardProps) {
  const t = useT()
  const [theme] = useTheme()
  /** 亚克力色板随主题切换 */
  const palette = ACRYLIC[theme === 'dark' ? 'dark' : 'light']
  const stageRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const badgeAvaRef = useRef<HTMLDivElement>(null)
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
  /** 视图切换的整圈旋转时间线（spin 用，便于连点时掐掉重来） */
  const spinTl = useRef<gsap.core.Timeline | null>(null)
  /** 徽章是否处于运动中（悬停微浮 / 翻转） */
  const moving = useRef({ hover: false, flip: false })
  /** 运动期间关闭正反面 backdrop-filter：它会每帧重采样背景，是翻转卡顿主因；
      is-dragging 单独标记拖拽/翻转（含 spin），用于关外投影（悬停微浮不关） */
  const syncMoving = () => {
    badgeRef.current?.classList.toggle(
      'is-moving',
      moving.current.hover || moving.current.flip,
    )
    badgeRef.current?.classList.toggle('is-dragging', moving.current.flip)
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

  // ── 悬停微浮 + 眼神跟随（触屏/减弱动效关闭） ──
  useEffect(() => {
    const stage = stageRef.current
    const badge = badgeRef.current
    if (!stage || !badge) return
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
        decoTo.forEach(({ depth, x, y }) => {
          x(px * depth * 26)
          y(py * depth * 20)
        })
      }
      const onLeave = () => {
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

  // ── 视图切换整圈旋转（Home 转场时经 ref 调用）──
  // 直接转 .badge 本体：stage 的 perspective + preserve-3d 全程有效，侧壁 3D 不被拍扁。
  // 物理感 = back.out 回弹（冲过 360° 再落回）+ squash & stretch + 投影同步压缩；
  // 装饰 emoji 在旋转层之外天然不随转，仅做错相位受扰抖动。
  const spin = () => {
    const badge = badgeRef.current
    const stage = stageRef.current
    if (!badge || !stage) return
    if (reducedMotion()) return

    spinTl.current?.kill()
    gsap.killTweensOf(badge)
    const decos = gsap.utils.toArray<HTMLElement>('[data-depth]', stage)
    decos.forEach((d) => gsap.killTweensOf(d))
    // 悬停微浮若在跑，让位给旋转（结束后由下一次 mouseenter 重建）
    if (floatRef.current) {
      floatRef.current.kill()
      floatRef.current = null
    }

    moving.current.flip = true
    syncMoving()
    setMicroPaused(true)

    // 单段惯性设计（刻意保持简单，抗打断优先）：
    //   一条 to rotationY: 360 的 back.out 缓动——「冲过落点→弹回停平」由缓动曲线自带，
    //   没有独立的回正段/缩放键帧/投影键帧，不存在可被掐断后变成孤儿的分段。
    //   目标是绝对值 360：任何时刻被新切换打断重开，新 tween 都从当前角度平滑续转到
    //   同一落点，兜底场景（切换过快）不会出现硬回正或残留形变。
    const tl = gsap.timeline({
      onComplete: () => {
        moving.current.flip = false
        syncMoving()
        setMicroPaused(false)
        gsap.set(badge, { rotationY: 0, scale: 1 })
      },
    })
    spinTl.current = tl

    tl.to(badge, { rotationY: 360, duration: 1.0, ease: 'back.out(1.2)' }, 0)

    // 装饰受扰抖动：独立轨、方向交替、相位错开（只动 rotation/scale，不碰 hover 视差的 x/y）
    decos.forEach((d, i) => {
      const dir = i % 2 ? -1 : 1
      tl.to(
        d,
        {
          keyframes: [
            { rotation: 14 * dir, scale: 1.18, duration: 0.14 },
            { rotation: -9 * dir, scale: 0.92, duration: 0.16 },
            { rotation: 5 * dir, scale: 1.06, duration: 0.14 },
            { rotation: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' },
          ],
        },
        0.25 + i * 0.08,
      )
    })
  }

  useImperativeHandle(ref, () => ({ spin }), [])

  // 侧壁与装饰：按实测直径等比换算（scale 见上方 ResizeObserver）
  const edgeD = BASE_EDGE_R * 2 * scale // 叠层圆直径 = 徽章直径
  const edgeT = BASE_EDGE_T * scale

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
        style={{ '--face-shrink': (1 - FILLET_AMT).toFixed(4) } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endFlip}
        onPointerCancel={endFlip}
        tabIndex={0}
        role="button"
        aria-label={t.cat.badgeAria}
        onKeyDown={onKeyDown}
      >
        {/* 真 3D 侧壁 v3：LAYERS 个真圆沿 Z 轴叠出厚度（i=0 背沿 → i=末 前沿）
            颜色沿层深连续插值：mid → hi → hi2，无离散色带/对半分色；
            圆角倒角：每侧 FILLET_LAYERS 层半径按二次缓动收缩（贴近表面收最多），
            正反面同步 scale(--face-shrink)，面/壁轮廓连续无台阶；
            倒角区提亮 s·8% 形成受光高光弧；
            层 z 收在 ±(T/2 - step/2) 内，与 ±T/2 的正反面保持半步距，避免共面 z-fighting */}
        {Array.from({ length: LAYERS }, (_, i) => {
          const t = i / (LAYERS - 1) // 0 = 背沿 → 1 = 前沿
          const c0 =
            t < 0.55
              ? mixColor(palette.mid, palette.hi, t / 0.55)
              : mixColor(palette.hi, palette.hi2, (t - 0.55) / 0.45)
          // 圆角倒角：dEnd = 距最近表面的层距；倒角区内按二次缓动收缩半径并提亮
          const dEnd = Math.min(i, LAYERS - 1 - i)
          const s = dEnd < FILLET_LAYERS ? (1 - dEnd / FILLET_LAYERS) ** 2 : 0
          const c = mixColor(c0, [255, 255, 255, 1], s * 0.08)
          const d = edgeD * (1 - FILLET_AMT * s)
          const z = (-edgeT / 2 + (edgeT * (i + 0.5)) / LAYERS).toFixed(2)
          return (
            <span
              key={i}
              className="badge-layer"
              style={{
                width: `${d}px`,
                height: `${d}px`,
                marginLeft: `${-d / 2}px`,
                marginTop: `${-d / 2}px`,
                transform: `translateZ(${z}px)`,
                background: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`,
                boxShadow: `0 0 0 1.1px rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`,
              }}
            />
          )
        })}

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
            alt={t.cat.avatarAlt}
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}
