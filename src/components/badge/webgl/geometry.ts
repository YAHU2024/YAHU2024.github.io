// 徽章 WebGL 几何与色板 —— 数值与旧 CSS 3D 版（CatCard）逐项对齐，
// 渲染侧只认这里导出的常量，改尺寸/层数/色板只动本文件。

export type RGBA = [number, number, number, number]

// ── 基准直径 340px 下的取值；实际尺寸按实测直径等比换算 ──
export const BASE_D = 340
export const BASE_EDGE_T = 28 // 侧壁厚度（直径:厚度 ≈ 12:1，薄玻璃水晶牌）
export const LAYERS = 28 // 侧壁层数（WebGL 无合成层纹理限制，触屏/桌面统一 28）
export const FILLET_LAYERS = 6 // 每侧倒角层数（≈21%，随层数等比）
export const FILLET_AMT = 0.018 // 表面圆角收缩比（抵消描边外扩，正反面同步收缩保持轮廓连续）
export const SHRINK = 1 - FILLET_AMT
export const SEGMENTS = 128 // 圆盘段数；context antialias:true 开 MSAA，不依赖 OES_standard_derivatives
/** 正/背面头像碗直径占比（300/340，与旧 .badge-ava 一致） */
export const BOWL_RATIO = 0.88235

// ── 亚克力水晶牌色板：沿层深三锚点连续插值（与 CatCard 的 ACRYLIC 同源）──
// 侧壁随主题呼应正面：浅色=暖白玻璃 / 深色=黑灰玻璃，保留微透
export const ACRYLIC = {
  light: {
    mid: [201, 191, 177, 0.9] as RGBA, // 背沿暖灰（背光面）
    hi: [236, 230, 221, 0.93] as RGBA, // 高光过渡
    hi2: [255, 255, 255, 0.96] as RGBA, // 前沿受光高光
  },
  dark: {
    mid: [13, 17, 27, 0.82] as RGBA,
    hi: [54, 62, 76, 0.88] as RGBA,
    hi2: [128, 138, 154, 0.92] as RGBA,
  },
} as const

export type Palette = { mid: RGBA; hi: RGBA; hi2: RGBA }

/** RGBA 两色线性插值，k ∈ [0,1] */
export function mixColor(a: RGBA, b: RGBA, k: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
    +(a[3] + (b[3] - a[3]) * k).toFixed(3),
  ]
}

/** 单位圆盘 triangle fan 顶点（中心 + 闭合环），drawArrays(TRIANGLE_FAN) 一次画完 */
export function buildUnitDisc(segments = SEGMENTS): Float32Array {
  const arr = new Float32Array((segments + 2) * 3)
  // arr[0..2] = 圆心 (0,0,0)
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const o = (i + 1) * 3
    arr[o] = Math.cos(a)
    arr[o + 1] = Math.sin(a)
    arr[o + 2] = 0
  }
  return arr
}

export interface LayerSpec {
  /** 层色（已含倒角提亮） */
  colorF: RGBA
  /** 层半径系数（1 = 徽章半径；倒角区按二次缓动收缩） */
  radiusF: number
  /** 层 z 偏移系数（-0.5 ~ 0.5，乘以侧壁厚度得 px） */
  zF: number
}

/** 按色板生成 28 层侧壁规格：层色三锚点插值 + 倒角收缩/提亮（数学同旧 CatCard） */
export function buildLayers(p: Palette): LayerSpec[] {
  return Array.from({ length: LAYERS }, (_, i) => {
    const t = i / (LAYERS - 1) // 0 = 背沿 → 1 = 前沿
    const c0 =
      t < 0.55
        ? mixColor(p.mid, p.hi, t / 0.55)
        : mixColor(p.hi, p.hi2, (t - 0.55) / 0.45)
    // 倒角：dEnd = 距最近表面的层距；倒角区内按二次缓动收缩半径并提亮 s·8%
    const dEnd = Math.min(i, LAYERS - 1 - i)
    const s = dEnd < FILLET_LAYERS ? (1 - dEnd / FILLET_LAYERS) ** 2 : 0
    const c = mixColor(c0, [255, 255, 255, 1], s * 0.08)
    return { colorF: c, radiusF: 1 - FILLET_AMT * s, zF: (i + 0.5) / LAYERS - 0.5 }
  })
}
