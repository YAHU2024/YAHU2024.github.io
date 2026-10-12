import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type {
  PointerEvent as RPointerEvent,
  KeyboardEvent as RKeyboardEvent,
  ReactNode,
  Ref,
} from 'react'
import gsap from 'gsap'
import { profile } from '@/data/github'
import { useT } from '@/hooks/useLocale'
import { useTheme } from '@/hooks/useTheme'
import CatFace, { CAT_GEO, PALETTE } from '@/components/CatFace'
import { BadgeRenderer, isWebGLAvailable, type FaceColors, type FaceFrames } from './webgl/renderer'
import {
  ACRYLIC,
  BASE_D,
  BOWL_RATIO,
  SHRINK,
  buildLayers,
  mixColor,
  type RGBA,
} from './webgl/geometry'
import Badge2DFallback from './Badge2DFallback'

/** 对外暴露的命令句柄：Home 在视图切换转场时调用 spin()（与旧 CatCardHandle 等价） */
export interface CatBadgeHandle {
  /** 整圈物理旋转：back.out 回弹 + 均匀缩放 squash，装饰/投影不随转而受扰 */
  spin: () => void
}

interface CatBadgeProps {
  ref?: Ref<CatBadgeHandle>
}

// 藏在徽章下一层、透过边缘玻璃透色的探索装饰（x/y = 相对圆心的偏移 px @340 基准）
const hiddenDecos = [
  { ch: '⭐', depth: 1.2, x: 130, y: 78 },
  { ch: '🐟', depth: 0.9, x: -132, y: 70 },
  { ch: '✨', depth: 1.4, x: 6, y: -150 },
]

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 触屏判定：hover:none 或 pointer:coarse 任一命中（pointer:coarse 不受内核怪癖影响） */
const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(hover: none)').matches ||
    window.matchMedia('(pointer: coarse)').matches)

// ── CSS 颜色解析：#rgb / #rrggbb / rgb() / rgba() → RGBA ──
function parseCSSColor(input: string): RGBA {
  const s = input.trim()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      1,
    ]
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number)
    if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
    }
  }
  return [255, 255, 255, 1]
}

/** 从 CSS 变量读面片配色（数据源唯一：改 index.css 变量即生效，无需改 TS） */
function readFaceColors(): FaceColors {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string) => parseCSSColor(cs.getPropertyValue(name))
  return {
    base: v('--face-base'),
    hi: v('--badge-hi'),
    border: v('--gborder'),
    glowInner: v('--glow-inner'),
    accentSoft: v('--accent-soft'),
    badgeInset: v('--badge-inset'),
    bg: v('--bg'),
    accent: v('--accent'),
  }
}

function mixFace(a: FaceColors, b: FaceColors, k: number): FaceColors {
  return {
    base: mixColor(a.base, b.base, k),
    hi: mixColor(a.hi, b.hi, k),
    border: mixColor(a.border, b.border, k),
    glowInner: mixColor(a.glowInner, b.glowInner, k),
    accentSoft: mixColor(a.accentSoft, b.accentSoft, k),
    badgeInset: mixColor(a.badgeInset, b.badgeInset, k),
    bg: mixColor(a.bg, b.bg, k),
    accent: mixColor(a.accent, b.accent, k),
  }
}

function mixPalette(a: (typeof ACRYLIC)['light'], b: (typeof ACRYLIC)['light'], k: number) {
  return {
    mid: mixColor(a.mid, b.mid, k),
    hi: mixColor(a.hi, b.hi, k),
    hi2: mixColor(a.hi2, b.hi2, k),
  }
}

/**
 * 猫脸变体帧光栅化：把 CatFace SVG 光栅化到离屏 canvas，作正面面片的碗内纹理。
 * 与徽章同一 WebGL 管线渲染 → 物理上不可能与模型分离（CSS 3D 覆盖层方案的
 * 内核兼容性问题由此根治）。SVG 上色全部内联、渐变 defs 自包含；
 * 眨眼/眯眼由 shader 程序化眼睑实现，耳抖/瞳孔放大由变体帧混合实现。
 * mutate 在克隆体上注入变体变换（耳旋转/瞳孔缩放），模板 SVG 保持中性态。
 */
async function rasterizeFaceFrame(
  svg: SVGSVGElement,
  bgColor: string,
  mutate?: (clone: SVGSVGElement) => void,
): Promise<HTMLCanvasElement> {
  // 768²：340px 徽章 @DPR2 碗面 ≈600 设备像素，1.28 倍采样余量（512 会轻微放大发虚）
  const SIZE = 768
  // 眼睑归位到睁眼基线（位移 = LID_H = ry+1 = 20 svg 单位）：原由 useCatMicro 的
  // gsap.set 完成，删除 hook 后由快照前手动设置——否则 SVG 默认眼睑盖眼（闭眼态）
  svg.querySelectorAll('[data-lid="top"]').forEach((el) => el.setAttribute('transform', 'translate(0, -20)'))
  svg.querySelectorAll('[data-lid="bottom"]').forEach((el) => el.setAttribute('transform', 'translate(0, 20)'))
  // 瞳孔组从纹理中移除：黑瞳/高光由 shader 程序化绘制并随视线平移——
  // 若保留在纹理里，会与偏移后的程序化瞳孔并存（双黑瞳）。眼白渐变底仍在纹理中。
  svg.querySelectorAll('[data-pupil]').forEach((el) => el.setAttribute('display', 'none'))
  const clone = svg.cloneNode(true) as SVGSVGElement
  mutate?.(clone)
  const xml = new XMLSerializer().serializeToString(clone)
  const withNs = xml.includes('xmlns=')
    ? xml
    : xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  // 无 width/height 的 SVG 在部分内核 drawImage 行为不定，注入固定尺寸
  const sized = withNs.replace('<svg', '<svg width="200" height="200"')
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('svg rasterize failed'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`
  })
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const g = c.getContext('2d')
  if (!g) throw new Error('2d context unavailable')
  g.fillStyle = bgColor
  g.fillRect(0, 0, SIZE, SIZE)
  g.drawImage(img, 0, 0, SIZE, SIZE)
  return c
}

// ── 公共外壳：舞台 + 接触投影 + 探索装饰（两条渲染分支共用）──
function BadgeShell({ children }: { children: (size: number) => ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)

  // useLayoutEffect：绘制前完成首帧测量，窄屏首帧装饰/画布就按实测直径摆放（防闪一帧）
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const apply = (w: number) => {
      if (w > 0) setSize(w)
    }
    apply(el.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) apply(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = size / BASE_D

  return (
    <div className="cat-stage relative mx-auto w-full max-w-sm select-none">
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

      <div ref={boxRef} className="badge-box">
        {children(size)}
      </div>
    </div>
  )
}

// ── WebGL 3D 分支 ──
function CatBadge3D({
  size,
  onFatal,
  fwdRef,
}: {
  size: number
  onFatal: () => void
  fwdRef?: Ref<CatBadgeHandle>
}) {
  const t = useT()
  const [theme] = useTheme()
  const themeRef = useRef(theme)
  const rendererRef = useRef<BadgeRenderer | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  /** 隐藏快照源容器（内含 CatFace SVG，供光栅化；不参与布局显示） */
  const faceHostRef = useRef<HTMLDivElement>(null)
  /** 状态提示固定层（醒来星星宿主；不随翻转） */
  const decoRef = useRef<HTMLDivElement>(null)
  /** 旋转姿态（rx/ry 单位 deg）：GSAP tween 的直接目标，applyPose 为唯一应用出口 */
  const pose = useRef({ rx: 0, ry: 0 })
  const flipping = useRef(false)
  const flipped = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const vel = useRef({ x: 0, y: 0 })
  const rafRef = useRef(0)
  const spinTl = useRef<gsap.core.Timeline | null>(null)
  const floatRef = useRef<gsap.core.Tween | null>(null)
  /**
   * 闭眼值跨主题切换持久（对比微表情 state 的每轮重建）：主题 effect 重跑时
   * gsap 从当前实际闭眼度渐变到新基线——否则 state 重建瞬间跳变，眼皮"瞬开瞬闭"。
   * closedInit 标记首挂载（直接落位，避免暗色刷新时先睁眼再渐眯的闪烁）。
   */
  const closedState = useRef({ v: 0 })
  const closedInit = useRef(true)
  /** 拖拽/翻转中：冻结眨眼调度与视线跟随 */
  const microPausedRef = useRef(false)
  /**
   * 微表情统一状态（GSAP tween 目标）：
   * gxl/gyl+gxr/gyr 双眼视线（每眼独立，汇聚指向鼠标，同旧版 EYE_FRAC）/
   * rot+tx+ty 头部微倾（弧度+SVG 单位）/ ear+pupil 变体帧混合
   * applyMicroState 是唯一应用出口（→ renderer），暂停复位由 micro effect 注入 resetMicroRef
   */
  const microState = useRef({ gxl: 0, gyl: 0, gxr: 0, gyr: 0, rot: 0, tx: 0, ty: 0, ear: 0, pupil: 0 })
  const applyMicroState = useCallback(() => {
    const r = rendererRef.current
    if (!r) return
    const s = microState.current
    r.setGaze(s.gxl, s.gyl, s.gxr, s.gyr)
    r.setFaceHead(s.rot, s.tx, s.ty)
    r.setEarBlend(s.ear)
    r.setPupilBlend(s.pupil)
  }, [])
  const resetMicroRef = useRef<(() => void) | null>(null)
  const syncMicroPause = (v: boolean) => {
    microPausedRef.current = v
    // 暂停即归零（同旧 useCatMicro 的 paused 行为：睁眼正视、耳/瞳复位）
    if (v) resetMicroRef.current?.()
  }

  // ── 姿态应用：旋转全部在 canvas 内（猫脸纹理与徽章同管线 → 绝对融合）──
  // size 走 ref 读取：applyPose 会被 GSAP 回调/事件闭包长期持有，不能捕获会过期的渲染期值
  const sizeMirror = useRef(0)
  const applyPose = () => {
    const { rx, ry } = pose.current
    rendererRef.current?.setRotation(rx, ry)
    rendererRef.current?.draw()
    // 微表情冻结阈值（|ry|>60° 或 |rx|>45°）
    syncMicroPause(Math.abs(ry) > 60 || Math.abs(rx) > 45)
  }

  // ── 正面猫脸变体帧：光栅化隐藏容器里的 CatFace SVG → 面片碗内纹理组 ──
  // 中性帧 + 耳抖 ±4°（绕耳根，CAT_GEO.ear origin）；瞳孔放大/视线/眨眼
  // 均为 shader 程序化（眼白渐变静止，只有黑瞳动）
  const applyFaceFrames = useCallback(() => {
    const svg = faceHostRef.current?.querySelector('svg')
    if (!(svg instanceof SVGSVGElement)) return
    // 碗底色走 --bowl-bg（暗色主题提亮为夜光表盘 #1d2640，浅色 = 页面底色）
    const cs2 = getComputedStyle(document.documentElement)
    const bg = cs2.getPropertyValue('--bowl-bg').trim() || cs2.getPropertyValue('--bg').trim() || '#ffffff'
    const earL = CAT_GEO.ear.left.origin
    const earR = CAT_GEO.ear.right.origin
    const mutateEar = (side: 'left' | 'right', deg: number) => (clone: SVGSVGElement) => {
      const el = clone.querySelector(`[data-ear="${side}"]`)
      const origin = side === 'left' ? earL : earR
      el?.setAttribute('transform', `rotate(${deg} ${origin})`)
    }
    Promise.all([
      rasterizeFaceFrame(svg, bg),
      rasterizeFaceFrame(svg, bg, mutateEar('left', 4)),
      rasterizeFaceFrame(svg, bg, mutateEar('left', -4)),
      rasterizeFaceFrame(svg, bg, mutateEar('right', 4)),
      rasterizeFaceFrame(svg, bg, mutateEar('right', -4)),
    ])
      .then(([neutral, earLPos, earLNeg, earRPos, earRNeg]) => {
        rendererRef.current?.setFaceFrames({ neutral, earLPos, earLNeg, earRPos, earRNeg } satisfies FaceFrames)
      })
      .catch(() => {
        /* 快照失败保留现有纹理 */
      })
  }, [])

  // ── 渲染器初始化（一次性）──
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = new BadgeRenderer(canvas, { onFatal })
    rendererRef.current = r
    if (!r.init()) {
      onFatal()
      return
    }
    const pal = PALETTE[themeRef.current]
    r.setFurColors(pal.fur, pal.furEdge)
    r.setPupilColor(pal.pupil)
    r.setBowlShadow(themeRef.current === 'dark' ? 0.34 : 0.15)
    r.setAvatarUrl(profile.avatarUrl)
    r.setSidePalette(buildLayers(themeRef.current === 'dark' ? ACRYLIC.dark : ACRYLIC.light))
    r.setFaceColors(readFaceColors())
    r.setRotation(0, 0)
    applyFaceFrames()
    return () => {
      r.dispose()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 尺寸联动：画布背板/侧壁厚度/覆盖层 translateZ 全部随实测直径换算 ──
  useLayoutEffect(() => {
    sizeMirror.current = size
    const r = rendererRef.current
    if (!r || size <= 0) return
    r.setSize(size)
    applyPose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  // ── 昼夜联动：侧壁色板 450ms 插值 + 面片配色跟随（Zzz/抖毛在覆盖层 DOM，见下）──
  const faceRef = useRef<FaceColors | null>(null)
  useEffect(() => {
    const r = rendererRef.current
    if (!r) return
    const next = readFaceColors() // useTheme.apply 已先更新 dataset.theme，此处读到新值
    const prev = faceRef.current ?? next
    faceRef.current = next
    const palFrom = theme === 'dark' ? ACRYLIC.light : ACRYLIC.dark
    const palTo = theme === 'dark' ? ACRYLIC.dark : ACRYLIC.light
    if (reducedMotion()) {
      r.setFaceColors(next)
      r.setSidePalette(buildLayers(palTo))
      r.setFurColors(PALETTE[theme].fur, PALETTE[theme].furEdge)
      r.setPupilColor(PALETTE[theme].pupil)
      r.setBowlShadow(theme === 'dark' ? 0.34 : 0.15)
      r.draw()
      applyFaceFrames()
      return
    }
    const mixState = { t: 0 }
    gsap.killTweensOf(mixState)
    gsap.to(mixState, {
      t: 1,
      duration: 0.45,
      ease: 'power1.inOut',
      onUpdate: () => {
        r.setFaceColors(mixFace(prev, next, mixState.t))
        r.setSidePalette(buildLayers(mixPalette(palFrom, palTo, mixState.t)))
        r.draw()
      },
    })
    // 眼睑色/瞳孔色与猫脸变体帧随主题更新（SVG 已由 React 提交为新色板）
    r.setFurColors(PALETTE[theme].fur, PALETTE[theme].furEdge)
    r.setPupilColor(PALETTE[theme].pupil)
    r.setBowlShadow(theme === 'dark' ? 0.34 : 0.15)
    applyFaceFrames()
  }, [theme, applyFaceFrames])

  // ── 日光轨：光源角随现实时间东升西落 ──
  // 6:00 日出（东 = 屏幕右 φ0）→ 18:00 日落（西 = 屏幕左 φπ）扫过天顶；
  // 夜间月光同路径但强度 0.35；晨昏 ±45min 内平滑过渡避免跳变。
  // 光角一天 15°/h，60s 刷新绰绰有余；draw() 事件驱动，不改状态不重绘。
  useEffect(() => {
    const apply = () => {
      const now = new Date()
      const t = now.getHours() + now.getMinutes() / 60
      const day = t >= 6 && t < 18
      const p = day ? (t - 6) / 12 : (t >= 18 ? t - 18 : t + 6) / 12
      const dusk = Math.min(
        Math.abs(t - 6), Math.abs(t - 18),
        Math.abs(t - 6 + 24), Math.abs(t - 18 + 24),
        Math.abs(t - 6 - 24), Math.abs(t - 18 - 24),
      )
      const k = 0.35 + 0.65 * gsap.utils.clamp(0, 1, dusk / 0.75)
      rendererRef.current?.setLight(p * Math.PI, k)
    }
    apply()
    const id = window.setInterval(apply, 60_000)
    return () => window.clearInterval(id)
  }, [])

  // ── 微表情（canvas 版）：眨眼（shader 眼睑）+ 视线跟随 + 头部微倾（shader 合成）
  //    + 耳朵抖动/瞳孔放大（CatFace 变体帧混合）──
  // 节奏/幅度参数与原 useCatMicro 对齐（含 reduced-motion 全静态化的 a11y 行为）
  useEffect(() => {
    const drowsy = theme === 'dark'
    const closedBase = drowsy ? 0.78 : 0 // 瞌睡眯眼基线
    const state = closedState.current // 跨主题切换持久：从当前闭眼度渐变
    const applyClosed = () => rendererRef.current?.setEyeClosed(state.v)
    const blink = (times: number) => {
      const tl = gsap.timeline()
      for (let i = 0; i < times; i += 1) {
        const at = i * 0.3
        tl.to(state, { v: 1, duration: 0.085, ease: 'power2.in', onUpdate: applyClosed }, at)
          .to(state, { v: closedBase, duration: 0.13, ease: 'power2.out', onUpdate: applyClosed }, at + 0.1)
      }
    }
    const s = microState.current

    // 减弱动效：全静态（同旧 useCatMicro——只保留眯眼基线，不调度任何动画）
    if (reducedMotion()) {
      Object.assign(s, { gxl: 0, gyl: 0, gxr: 0, gyr: 0, rot: 0, tx: 0, ty: 0, ear: 0, pupil: 0 })
      state.v = closedBase
      applyMicroState()
      applyClosed()
      return () => {
        gsap.killTweensOf(state)
      }
    }

    let blinkTimer = 0
    const scheduleBlink = () => {
      window.clearTimeout(blinkTimer)
      const base = drowsy ? 4500 : 2600
      const jitter = drowsy ? 4000 : 3000
      blinkTimer = window.setTimeout(() => {
        scheduleBlink()
        if (microPausedRef.current) return
        if (drowsy && Math.random() < 0.55) return
        blink(Math.random() < 0.18 ? 2 : 1)
      }, base + Math.random() * jitter)
    }
    scheduleBlink()
    // 眯眼/睁眼过渡：首挂载直接落位（暗色刷新不闪烁）；主题切换从当前闭眼度
    // 渐变到新基线——入睡 1.5s / 醒来 1.0s（旧 0.9/0.5 偏快 + state 重建导致瞬变），
    // power2.inOut 首尾缓，眼皮缓慢合拢/掀开更有"困意上头 / 秒醒回神"的生动感
    if (closedInit.current) {
      closedInit.current = false
      state.v = closedBase
      applyClosed()
    } else {
      gsap.to(state, { v: closedBase, duration: drowsy ? 1.5 : 1.0, ease: 'power2.inOut', onUpdate: applyClosed, overwrite: true })
    }

    // 视线 + 头部微倾：quickTo 平滑滞后（旧版 0.45s / 0.9s power2.out）
    // 视线幅度 = 旧 PUPIL_MAX 5.4/4.0 SVG 单位换算局部单位（1 SVG = bowl/100）
    const bowl = BOWL_RATIO / SHRINK
    const ampX = ((5.4 * bowl) / 100) * (drowsy ? 0.45 : 1)
    const ampY = ((4.0 * bowl) / 100) * (drowsy ? 0.45 : 1)
    const tiltRotMax = (2.2 * Math.PI) / 180 // 旧 TILT_ROT 2.2°
    const tiltXMax = 1.8 // SVG 单位（shader 内换算局部）
    const tiltYMax = 1.2
    const qgxl = gsap.quickTo(s, 'gxl', { duration: 0.45, ease: 'power2.out', onUpdate: applyMicroState })
    const qgyl = gsap.quickTo(s, 'gyl', { duration: 0.45, ease: 'power2.out', onUpdate: applyMicroState })
    const qgxr = gsap.quickTo(s, 'gxr', { duration: 0.45, ease: 'power2.out', onUpdate: applyMicroState })
    const qgyr = gsap.quickTo(s, 'gyr', { duration: 0.45, ease: 'power2.out', onUpdate: applyMicroState })
    const qrot = gsap.quickTo(s, 'rot', { duration: 0.9, ease: 'power2.out', onUpdate: applyMicroState })
    const qtx = gsap.quickTo(s, 'tx', { duration: 0.9, ease: 'power2.out', onUpdate: applyMicroState })
    const qty = gsap.quickTo(s, 'ty', { duration: 0.9, ease: 'power2.out', onUpdate: applyMicroState })
    const onMove = (e: MouseEvent) => {
      if (microPausedRef.current) return
      const box = badgeRef.current?.getBoundingClientRect()
      if (!box) return
      // 双眼各自朝向鼠标（同旧版 EYE_FRAC：每眼从自身中心测方向与距离 → 瞳孔汇聚，
      // 而非双眼平行移动）；距离饱和同旧版 REACH_RATIO 1.15
      const side = Math.min(box.width, box.height) || 1
      const vb = CAT_GEO.viewBox
      const eyes = [
        { fx: CAT_GEO.eye.left.cx / vb.w, fy: CAT_GEO.eye.left.cy / vb.h },
        { fx: CAT_GEO.eye.right.cx / vb.w, fy: CAT_GEO.eye.right.cy / vb.h },
      ]
      const aim = (
        eye: { fx: number; fy: number },
        qx: (v: number) => void,
        qy: (v: number) => void,
      ) => {
        const dx = e.clientX - (box.left + eye.fx * box.width)
        const dy = e.clientY - (box.top + eye.fy * box.height)
        const dist = Math.hypot(dx, dy) || 1
        const reach = Math.min(1, dist / (side * 1.15))
        qx((dx / dist) * reach * ampX)
        qy((dy / dist) * reach * ampY)
      }
      aim(eyes[0], qgxl, qgyl)
      aim(eyes[1], qgxr, qgyr)
      // 头部微倾：整颗头朝鼠标方向轻倾（从徽章中心测，clamp ±1，同旧版）
      const kx = gsap.utils.clamp(-1, 1, (e.clientX - (box.left + box.width / 2)) / (side * 2.2))
      const ky = gsap.utils.clamp(-1, 1, (e.clientY - (box.top + box.height / 2)) / (side * 2.2))
      qrot(kx * tiltRotMax)
      qtx(kx * tiltXMax)
      qty(ky * tiltYMax)
    }

    // 暂停复位（拖拽/翻转/转场）：视线/头倾走 quickTo 自身归零（overwrite 会杀掉
    // 可复用 tween 导致恢复后失效——旧版教训），混合因子 gsap 归零
    resetMicroRef.current = () => {
      qgxl(0)
      qgyl(0)
      qgxr(0)
      qgyr(0)
      qrot(0)
      qtx(0)
      qty(0)
      // 耳/瞳复位时长对齐旧 paused（ears 0.3s power2.out）
      gsap.to(s, { ear: 0, pupil: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto', onUpdate: applyMicroState })
    }

    // 耳朵抖动：每 6.5~15.5s，随机耳/方向，4°→0→3°→弹性回位（节奏同旧版）
    let earTimer = 0
    const scheduleEar = () => {
      window.clearTimeout(earTimer)
      earTimer = window.setTimeout(() => {
        scheduleEar()
        if (microPausedRef.current) return
        rendererRef.current?.setEarFrame(Math.floor(Math.random() * 4))
        gsap
          .timeline()
          .to(s, { ear: 1, duration: 0.09, ease: 'power2.out', onUpdate: applyMicroState })
          .to(s, { ear: 0, duration: 0.09, ease: 'power2.in', onUpdate: applyMicroState })
          .to(s, { ear: 0.75, duration: 0.08, ease: 'power2.out', onUpdate: applyMicroState })
          .to(s, { ear: 0, duration: 0.28, ease: 'elastic.out(1, 0.5)', onUpdate: applyMicroState })
      }, 6500 + Math.random() * 9000)
    }
    scheduleEar()

    // 瞳孔放大：悬停徽章时 1.14×（帧混合淡入淡出，同旧版节奏）
    const badge = badgeRef.current
    const onEnter = () => {
      if (microPausedRef.current) return
      gsap.to(s, { pupil: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto', onUpdate: applyMicroState })
    }
    const onLeave = () => {
      gsap.to(s, { pupil: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto', onUpdate: applyMicroState })
    }
    badge?.addEventListener('mouseenter', onEnter)
    badge?.addEventListener('mouseleave', onLeave)
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.clearTimeout(blinkTimer)
      window.clearTimeout(earTimer)
      window.removeEventListener('mousemove', onMove)
      badge?.removeEventListener('mouseenter', onEnter)
      badge?.removeEventListener('mouseleave', onLeave)
      gsap.killTweensOf(state)
      gsap.killTweensOf(s)
      resetMicroRef.current = null
    }
  }, [theme, applyMicroState])

  // ── 悬停微浮 + 装饰视差（触屏/减弱动效关闭）──
  useEffect(() => {
    const badge = badgeRef.current
    const stage = badge?.closest('.cat-stage')
    if (!badge || !(stage instanceof HTMLElement)) return
    if (reducedMotion() || isTouchDevice()) return

    const ctx = gsap.context(() => {
      const startFloat = () => {
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
        gsap.to(badge, { y: 0, duration: 0.6, ease: 'power2.out' })
      }
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

  // ── 自由 X+Y 翻转（pointer 拖拽，跟手，松手惯性归位）──
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (flipping.current) return
    flipping.current = true
    flipped.current = false
    badgeRef.current?.classList.add('is-dragging')
    syncMicroPause(true)
    badgeRef.current?.setPointerCapture?.(e.pointerId)
    last.current = { x: e.clientX, y: e.clientY }
    gsap.killTweensOf(pose.current)
    gsap.to(badgeRef.current, { scale: 1.05, duration: 0.2, ease: 'power2.out' })
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!flipping.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    pose.current.ry += dx * 0.6
    pose.current.rx -= dy * 0.6
    vel.current = { x: -dy * 0.6, y: dx * 0.6 }
    // rAF 节流：高刷屏上 pointermove 可能一帧多次，合并为每帧只应用一次
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      applyPose()
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
      applyPose()
    }
    if (reducedMotion()) {
      pose.current = { rx: 0, ry: 0 }
      applyPose()
      gsap.set(badgeRef.current, { scale: 1 })
      badgeRef.current?.classList.remove('is-dragging')
      syncMicroPause(false)
      return
    }
    // 惯性：把松手前角速度折算成额外旋转余量
    pose.current.ry += vel.current.y * 6
    pose.current.rx += vel.current.x * 6
    gsap.to(pose.current, {
      rx: 0,
      ry: 0,
      duration: 1.3,
      ease: 'elastic.out(1, 0.5)',
      onUpdate: applyPose,
      onComplete: () => {
        badgeRef.current?.classList.remove('is-dragging')
        syncMicroPause(false)
      },
    })
  }

  // ── 键盘翻转：翻到背面停留，再按回正面 ──
  const onKeyDown = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    flipped.current = !flipped.current
    badgeRef.current?.classList.add('is-dragging')
    syncMicroPause(true)
    gsap.killTweensOf(pose.current)
    gsap.to(pose.current, {
      rx: 0,
      ry: flipped.current ? 180 : 0,
      duration: 0.8,
      ease: 'power3.inOut',
      onUpdate: applyPose,
      onComplete: () => {
        badgeRef.current?.classList.remove('is-dragging')
        if (!flipped.current) syncMicroPause(false)
      },
    })
  }

  // ── 视图切换整圈旋转（Home 转场时经 ref 调用）──
  // 旋转走 pose（WebGL + 覆盖层同步），容器只加均匀缩放 squash（2D 变换，安全）
  const spin = () => {
    const badge = badgeRef.current
    const stage = badge?.closest('.cat-stage')
    if (!badge) return
    if (reducedMotion()) return

    spinTl.current?.kill()
    gsap.killTweensOf(pose.current)
    gsap.killTweensOf(badge)
    const decos =
      stage instanceof HTMLElement ? gsap.utils.toArray<HTMLElement>('[data-depth]', stage) : []
    decos.forEach((d) => gsap.killTweensOf(d))
    if (floatRef.current) {
      floatRef.current.kill()
      floatRef.current = null
    }

    badge.classList.add('is-dragging')
    syncMicroPause(true)

    // 单段惯性设计（抗打断优先，同旧版）：back.out 冲过落点→弹回停平
    const tl = gsap.timeline({
      onComplete: () => {
        pose.current.rx = 0
        pose.current.ry = 0
        applyPose()
        badge.classList.remove('is-dragging')
        syncMicroPause(false)
        gsap.set(badge, { scale: 1 })
      },
    })
    spinTl.current = tl

    tl.to(
      pose.current,
      {
        ry: pose.current.ry + 360,
        duration: 1.0,
        ease: 'back.out(1.2)',
        onUpdate: applyPose,
      },
      0,
    )
    tl.to(badge, { scale: 1.05, duration: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0)

    // 装饰受扰抖动：独立轨、方向交替、相位错开（只动 rotation/scale，不碰视差 x/y）
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

  // 空依赖有意为之：spin 内部全走 ref/GSAP，句柄只需创建一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(fwdRef, () => ({ spin }), [])

  // ── 昼夜联动：切回浅色秒醒抖毛撒星星（状态提示固定层，不随翻转）──
  const prevTheme = useRef(theme)
  useEffect(() => {
    const ava = decoRef.current
    if (!ava) return
    const reduced = reducedMotion()
    const wasDark = prevTheme.current === 'dark'
    prevTheme.current = theme

    if (theme === 'dark' || !wasDark || reduced) return

    // 抖毛摇摆作用于徽章本体（badge3d 的 transform 全程由 gsap 管理，x 与 scale 并存
    // 无冲突；旧版摇 .badge-ava 碗 = WebGL 版摇整只徽章）。空宿主层位移不可见，
    // 之前挂错目标导致动效"丢失"。
    const badge = badgeRef.current
    if (badge) {
      gsap.to(badge, {
        keyframes: [
          { x: -5, duration: 0.07 },
          { x: 5, duration: 0.07 },
          { x: -3, duration: 0.07 },
          { x: 3, duration: 0.07 },
          { x: 0, duration: 0.07 },
        ],
      })
    }
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

  return (
    <div
      ref={badgeRef}
      className="badge3d"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endFlip}
      onPointerCancel={endFlip}
      tabIndex={0}
      role="button"
      aria-label={t.cat.badgeAria}
      onKeyDown={onKeyDown}
    >
      {/* WebGL 层：侧壁圆盘堆栈 + 正面猫脸碗 + 背面头像碗（几何真 3D，全部同管线） */}
      <canvas ref={canvasRef} className="badge-canvas" aria-hidden />

      {/* 状态提示固定层：醒来星星宿主（不随翻转；Zzz 已按需求移除） */}
      <div ref={decoRef} className="badge-state-layer" aria-hidden />

      {/* 隐藏快照源：CatFace SVG 供光栅化为正面纹理（不参与显示） */}
      <div ref={faceHostRef} aria-hidden className="badge-face-host">
        <CatFace theme={theme} />
      </div>
    </div>
  )
}

/**
 * Hero 右侧的互动猫徽章（唯一入口，替代旧 CatCard）：
 * - WebGL 可用：canvas 渲染 3D 徽章，正面猫脸/背面头像均为面片碗内纹理（绝对融合）
 * - WebGL 不可用 / context lost 恢复失败：Badge2DFallback 平面徽章接管
 */
export default function CatBadge({ ref }: CatBadgeProps) {
  const supported = useState(isWebGLAvailable)[0]
  const [failed, setFailed] = useState(false)

  return (
    <BadgeShell>
      {(size) =>
        supported && !failed ? (
          <CatBadge3D size={size} onFatal={() => setFailed(true)} fwdRef={ref} />
        ) : (
          <Badge2DFallback fwdRef={ref} />
        )
      }
    </BadgeShell>
  )
}
