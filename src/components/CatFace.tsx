import { useId } from 'react'
import type { Theme } from '@/hooks/useTheme'

/**
 * 猫脸几何（viewBox 0 0 200 200）
 * .badge-ava 为 300×300，即 1 用户单位 = 1.5 CSS 像素
 * 这些常量同时被 useCatMicro 读取，改这里两处自动同步
 */
export const CAT_GEO = {
  viewBox: { w: 200, h: 200 },
  eye: {
    left: { cx: 74, cy: 108 },
    right: { cx: 126, cy: 108 },
    rx: 17,
    ry: 19,
    pupilR: 8.2,
  },
  /** 耳朵旋转支点（贴耳根，抖动时不会脱离头部） */
  ear: {
    left: { origin: '71 64' },
    right: { origin: '129 64' },
  },
  /** 整颗头（含耳朵）的倾斜支点 */
  headOrigin: '100 122',
} as const

type Palette = {
  fur: string
  furEdge: string
  innerEar: string
  sclera: string
  scleraHi: string
  scleraDeep: string
  pupil: string
  shine: string
  nose: string
  mouth: string
  whisker: string
  brow: string
}

const PALETTE: Record<Theme, Palette> = {
  light: {
    fur: '#2f2f3a',
    furEdge: '#20202a',
    innerEar: '#ff9db0',
    sclera: '#f3c33f',
    scleraHi: '#ffe07a',
    scleraDeep: '#d99a1f',
    pupil: '#131320',
    shine: '#ffffff',
    nose: '#ff9db0',
    mouth: 'rgba(255,255,255,0.6)',
    whisker: 'rgba(255,255,255,0.42)',
    brow: 'rgba(255,255,255,0.55)',
  },
  dark: {
    fur: '#1a1f2e',
    furEdge: '#0b0e17',
    innerEar: '#7f9ad6',
    sclera: '#dfb03c',
    scleraHi: '#ffd76a',
    scleraDeep: '#b7802a',
    pupil: '#070a11',
    shine: '#ffffff',
    nose: '#7f9ad6',
    mouth: 'rgba(205,225,255,0.42)',
    whisker: 'rgba(160,190,255,0.3)',
    brow: 'rgba(180,210,255,0.4)',
  },
}

interface EyeProps {
  uid: string
  side: 'left' | 'right'
  p: Palette
}

/**
 * 单只眼睛：clipPath 内依次叠 眼白 → 瞳孔组 → 上眼睑 → 下眼睑
 * - 瞳孔组带 data-pupil，由 useCatMicro 驱动 x/y 做视线跟随
 * - 上下眼睑带 data-lid，y=0 时在中线闭合，形成一条深色眼缝
 */
function CatEye({ uid, side, p }: EyeProps) {
  const { rx, ry, pupilR } = CAT_GEO.eye
  const { cx, cy } = CAT_GEO.eye[side]
  const lidW = rx * 2 + 2
  /** 眼睑高度 = ry + 2：比半只眼多 2 单位，睁开时整片（含闭合线）完全退出眼眶，不留残影 */
  const lidH = ry + 2
  const clipId = `cat-eye-clip-${uid}-${side}`
  const gradId = `cat-sclera-${uid}-${side}`

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </clipPath>
        <radialGradient id={gradId} gradientUnits="userSpaceOnUse" cx={cx - rx * 0.2} cy={cy - ry * 0.35} r={rx * 1.5}>
          <stop offset="0%" stopColor={p.scleraHi} />
          <stop offset="62%" stopColor={p.sclera} />
          <stop offset="100%" stopColor={p.scleraDeep} />
        </radialGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gradId})`} />

        {/* 瞳孔组（跟随鼠标） */}
        <g data-pupil>
          <ellipse cx={cx} cy={cy} rx={pupilR * 0.86} ry={pupilR} fill={p.pupil} />
          <circle cx={cx - pupilR * 0.34} cy={cy - pupilR * 0.42} r={pupilR * 0.3} fill={p.shine} opacity={0.92} />
          <circle cx={cx + pupilR * 0.32} cy={cy + pupilR * 0.3} r={pupilR * 0.15} fill={p.shine} opacity={0.42} />
        </g>

        {/* 上眼睑：完全睁开时被推到眼眶上方（y = -(ry+1)），闭合时 y = 0 */}
        <g data-lid="top">
          <rect x={cx - rx - 1} y={cy - ry - 1} width={lidW} height={lidH} fill={p.fur} />
          <rect x={cx - rx - 1} y={cy - 1.5} width={lidW} height={3} rx={1.5} fill={p.furEdge} />
        </g>
        {/* 下眼睑：完全睁开时被推到眼眶下方（y = ry+1），闭合时 y = 0 */}
        <g data-lid="bottom">
          <rect x={cx - rx - 1} y={cy} width={lidW} height={lidH} fill={p.fur} />
        </g>
      </g>

      {/* 眼眶粗描边（brutalist 硬边，同时盖住眼睑裁切毛边） */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={p.furEdge} strokeWidth={3} />
    </g>
  )
}

/**
 * 矢量猫脸：黑猫 + 黄色大眼，眼睛分层可控
 * 供 .badge-ava（300×300 圆形）铺满使用
 */
export default function CatFace({ theme = 'light' }: { theme?: Theme }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const p = PALETTE[theme]

  return (
    <svg
      data-cat
      className="cat-svg"
      viewBox={`0 0 ${CAT_GEO.viewBox.w} ${CAT_GEO.viewBox.h}`}
      role="img"
      aria-label="YAHU 的猫头像，会眨眼并跟随鼠标看"
    >
      {/* 整颗头：data-head 由 useCatMicro 做微倾 */}
      <g data-head>
        {/* 耳朵（头后一层；耳根深埋头部，补丁圆固定耳根，旋转时不露裁切角） */}
        <g data-ear="left">
          <circle cx={71} cy={64} r={22} fill={p.fur} />
          <path d="M 44,88 Q 50,38 60,22 Q 74,36 98,52 Z" fill={p.fur} stroke={p.furEdge} strokeWidth={3} strokeLinejoin="round" />
          <path d="M 56,80 Q 61,44 66,34 Q 76,46 90,56 Z" fill={p.innerEar} opacity={0.85} />
        </g>
        <g data-ear="right">
          <circle cx={129} cy={64} r={22} fill={p.fur} />
          <path d="M 156,88 Q 150,38 140,22 Q 126,36 102,52 Z" fill={p.fur} stroke={p.furEdge} strokeWidth={3} strokeLinejoin="round" />
          <path d="M 144,80 Q 139,44 134,34 Q 124,46 110,56 Z" fill={p.innerEar} opacity={0.85} />
        </g>

        {/* 头部 */}
        <ellipse cx={100} cy={112} rx={68} ry={60} fill={p.fur} stroke={p.furEdge} strokeWidth={3} />
        {/* 额头高光（额头顶部，收窄右移避免压到左耳；不与眼睛/眼睑区域重叠） */}
        <ellipse cx={102} cy={70} rx={28} ry={14} fill={p.brow} opacity={0.5} />

        {/* 胡须 */}
        <g fill="none" stroke={p.whisker} strokeWidth={2} strokeLinecap="round">
          <path d="M 48,126 Q 30,120 12,116" />
          <path d="M 46,134 Q 28,134 10,134" />
          <path d="M 48,142 Q 30,148 14,152" />
          <path d="M 152,126 Q 170,120 188,116" />
          <path d="M 154,134 Q 172,134 190,134" />
          <path d="M 152,142 Q 170,148 186,152" />
        </g>

        {/* 鼻子 + 嘴 */}
        <path d="M 100,128 L 107,136 Q 100,140 93,136 Z" fill={p.nose} />
        <g fill="none" stroke={p.mouth} strokeWidth={2.2} strokeLinecap="round">
          <path d="M 100,140 Q 100,148 89,146" />
          <path d="M 100,140 Q 100,148 111,146" />
        </g>

        {/* 双眼（最后绘制，保证眼睑盖在最上层） */}
        <CatEye uid={uid} side="left" p={p} />
        <CatEye uid={uid} side="right" p={p} />
      </g>
    </svg>
  )
}
