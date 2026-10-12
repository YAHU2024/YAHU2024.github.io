// 徽章 WebGL 渲染器：裸 WebGL1，零依赖。
// 职责：28 层侧壁圆盘 + 正/背面圆面片的绘制、头像纹理、context lost 处理。
// 渲染时机：完全事件驱动（setRotation/setSize/setFaceColors 后手动 draw()），
// 静止时零 GPU 负载；所有调用方都在 rAF/GSAP tick 内，天然按帧合帧。

import {
  buildUnitDisc,
  SEGMENTS,
  SHRINK,
  BOWL_RATIO,
  BASE_D,
  BASE_EDGE_T,
  type LayerSpec,
  type RGBA,
} from './geometry'
import { VERT, FRAG } from './shaders'

/** 面片着色所需颜色（全部来自站点 CSS 变量，由组件读取后注入） */
export interface FaceColors {
  base: RGBA // --face-base
  hi: RGBA // --badge-hi
  border: RGBA // --gborder
  glowInner: RGBA // --glow-inner
  accentSoft: RGBA // --accent-soft
  badgeInset: RGBA // --badge-inset
  bg: RGBA // --bg（头像兜底圆底色）
  accent: RGBA // --accent（头像兜底描边/字标）
}

/** canvas 相对徽章直径的放大系数：旋转时圆盘投影最大外扩 d/(d-R) ≈ 1.2 倍，1.35 足够不裁切 */
const CANVAS_MARGIN = 1.35
/** 透视距离（css px）：canvas 内部除法与猫脸覆盖层 transform 的 perspective() 共用 */
export const PERSPECTIVE_D = 1000
const DPR_CAP = 2

/** uniform4f 需要 0~1 浮点：RGBA 元组的 RGB 为 0-255 字节需归一化，alpha 本身已在 0~1 保持原值 */
const norm = (c: RGBA): [number, number, number, number] => [c[0] / 255, c[1] / 255, c[2] / 255, c[3]]

/** WebGL 可用性探测（模块级缓存，避免反复建上下文） */
let glSupportedCache: boolean | null = null
export function isWebGLAvailable(): boolean {
  if (glSupportedCache !== null) return glSupportedCache
  try {
    const c = document.createElement('canvas')
    glSupportedCache = !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
  } catch {
    glSupportedCache = false
  }
  return glSupportedCache
}

/** 微表情变体帧集合（组件从 CatFace SVG 离线光栅化后注入） */
export interface FaceFrames {
  neutral: TexImageSource
  /** 耳朵抖动变体：±4° 绕耳根旋转（左耳正/负，右耳正/负） */
  earLPos: TexImageSource
  earLNeg: TexImageSource
  earRPos: TexImageSource
  earRNeg: TexImageSource
}

/** 耳朵变体帧索引（与 FaceFrames 字段对应） */
export const EAR_FRAMES = ['earLPos', 'earLNeg', 'earRPos', 'earRNeg'] as const

export class BadgeRenderer {
  private canvas: HTMLCanvasElement
  private onFatal?: () => void
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private tex: WebGLTexture | null = null
  private faceTex: WebGLTexture | null = null
  private earTex: WebGLTexture | null = null
  private lastTexSrc: TexImageSource | null = null // context restored 后重传用
  private faceTexSrc: TexImageSource | null = null // 正面猫脸纹理，restored 重传用
  private earTexSrcs: (TexImageSource | null)[] = [null, null, null, null]
  private earFrameIdx = 0 // 当前绑定到 unit2 的耳朵变体
  private avatarReady = false
  private closed = 0 // 眨眼/眯眼因子 0(睁)~1(闭)
  private gazeL: [number, number] = [0, 0] // 左眼视线偏移（局部单位）
  private gazeR: [number, number] = [0, 0] // 右眼视线偏移（每眼独立 → 双眼汇聚）
  private earBlend = 0 // 耳朵变体帧混合 0(中性)~1(变体)
  private pupilBlend = 0 // 瞳孔放大因子 0(中性)~1(放大 1.14×，shader 内半径缩放)
  private faceRot = 0 // 头部微倾（弧度，正 = 屏幕顺时针）
  private faceTilt: [number, number] = [0, 0] // 头部微倾平移（SVG 单位，屏幕方向）
  private fur: [number, number, number] = [47, 47, 58] // 眼睑色（CatFace palette.fur，随主题更新）
  private furEdge: [number, number, number] = [32, 32, 42] // 眼睑缘色（palette.furEdge）
  private pupilCol: [number, number, number] = [19, 19, 32] // 瞳孔色（palette.pupil，随主题更新）
  private loc: Record<string, WebGLUniformLocation | null> = {}

  // 渲染状态（dispose 前保持，context restored 后复用）
  private rx = 0
  private ry = 0
  private cssSize = 0 // 徽章直径 css px
  private layers: LayerSpec[] = []
  private face: FaceColors | null = null
  private disposed = false
  /** 绘制合并标志：draw() 已排队待 microtask flush */
  private drawQueued = false

  constructor(canvas: HTMLCanvasElement, opts?: { onFatal?: () => void }) {
    this.canvas = canvas
    this.onFatal = opts?.onFatal
    canvas.addEventListener('webglcontextlost', this.handleLost)
    canvas.addEventListener('webglcontextrestored', this.handleRestored)
  }

  // ── context lost：preventDefault 才允许 restore；恢复失败由 onFatal 切 2D 兜底 ──
  private handleLost = (e: Event) => {
    e.preventDefault()
    this.gl = null
    this.program = null
    this.buffer = null
    this.tex = null
    this.faceTex = null
    this.earTex = null
  }

  private handleRestored = () => {
    try {
      if (!this.initGL()) throw new Error('reinit failed')
      if (this.lastTexSrc) this.uploadTexture(this.lastTexSrc)
      const gl = this.gl
      if (gl) {
        if (this.faceTexSrc && this.faceTex) {
          gl.bindTexture(gl.TEXTURE_2D, this.faceTex)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.faceTexSrc)
        }
        // 微表情变体帧重传
        this.earTexSrcs.forEach((src) => {
          if (src) this.uploadFrameTexture(this.earTex, src)
        })
      }
      this.draw()
    } catch {
      this.onFatal?.()
    }
  }

  /** 创建 GL 上下文并编译资源；失败返回 false（调用方切 2D 兜底） */
  init(): boolean {
    try {
      return this.initGL()
    } catch {
      return false
    }
  }

  private initGL(): boolean {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      // 预乘合成（默认 true）：FS 末尾把 rgb 乘回 a，配 blendFuncSeparate(ONE, ...)
      // ——不用 premultipliedAlpha:false，该路径在软件渲染/部分设备上有白色污染问题
      antialias: false, // MSAA 在 SwiftShader/部分移动 GPU 的 alpha resolve 有白色污染；边缘 AA 由 FS smoothstep 完成
    })
    if (!gl) return false
    const program = createProgram(gl, VERT, FRAG)
    if (!program) return false
    this.gl = gl
    this.program = program

    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, buildUnitDisc(), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)

    gl.disable(gl.DEPTH_TEST) // painter's algorithm 背到前排序
    gl.enable(gl.BLEND)
    // 预乘 src-over：FS 输出已预乘（rgb *= a），故 RGB 因子用 ONE
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    this.tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // unit1：正面猫脸纹理（与徽章同管线渲染 → 物理上不可能与模型分离）
    this.faceTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.faceTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // unit2：耳朵抖动变体帧（瞳孔放大已程序化，无需纹理），与中性帧同参数
    this.earTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.earTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    for (const name of [
      'u_rot', 'u_radius', 'u_z', 'u_d', 'u_half', 'u_mode', 'u_color',
      'u_base', 'u_hi', 'u_hiC', 'u_border', 'u_glowIn', 'u_accent', 'u_inset',
      'u_px', 'u_bowl', 'u_tex', 'u_faceTex', 'u_earTex', 'u_closed',
      'u_gazeL', 'u_gazeR', 'u_earBlend', 'u_pupilBlend', 'u_faceRot', 'u_faceTilt', 'u_fur', 'u_furEdge', 'u_pupilCol', 'u_cosRy', 'u_light', 'u_bowlShA',
    ]) {
      this.loc[name] = gl.getUniformLocation(program, name)
    }
    return true
  }

  /** 上传正面猫脸纹理（组件光栅化的快照 canvas；与徽章同管线 → 物理上不可能分离） */
  setFaceTexture(src: TexImageSource) {
    if (this.disposed || !this.gl) return
    this.faceTexSrc = src
    const gl = this.gl
    if (!gl || !this.faceTex) return
    gl.bindTexture(gl.TEXTURE_2D, this.faceTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    this.draw()
  }

  /** 上传微表情变体帧集合（中性/耳朵±；瞳孔放大为 shader 程序化，无纹理；主题切换时整组重建） */
  setFaceFrames(frames: FaceFrames) {
    if (this.disposed || !this.gl) return
    this.faceTexSrc = frames.neutral
    this.earTexSrcs = [frames.earLPos, frames.earLNeg, frames.earRPos, frames.earRNeg]
    this.uploadFrameTexture(this.faceTex, frames.neutral)
    this.earTexSrcs.forEach((src) => {
      if (src) this.uploadFrameTexture(this.earTex, src)
    })
    this.draw()
  }

  /** 变体帧纹理上传（采样参数在 initGL 已建好，只贴图） */
  private uploadFrameTexture(target: WebGLTexture | null, src: TexImageSource) {
    const gl = this.gl
    if (!gl || !target || !src) return
    gl.bindTexture(gl.TEXTURE_2D, target)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  }

  /** 选择耳朵变体帧（0 earLPos / 1 earLNeg / 2 earRPos / 3 earRNeg） */
  setEarFrame(i: number) {
    if (this.earFrameIdx === i) return
    this.earFrameIdx = Math.max(0, Math.min(EAR_FRAMES.length - 1, i))
    this.draw()
  }

  setEarBlend(v: number) {
    this.earBlend = v
    this.draw()
  }

  setPupilBlend(v: number) {
    this.pupilBlend = v
    this.draw()
  }

  /** 头部微倾：rot 弧度（正 = 屏幕顺时针），tx/ty SVG 单位（屏幕方向 y 下正） */
  setFaceHead(rot: number, tx: number, ty: number) {
    this.faceRot = rot
    this.faceTilt = [tx, ty]
    this.draw()
  }

  /** 眨眼/眯眼因子：0 全睁 → 1 全闭（shader 程序化眼睑） */
  setEyeClosed(v: number) {
    this.closed = v
    this.draw()
  }

  /** 视线偏移（局部单位，左右眼各一份：双眼从各自中心测向 → 汇聚指向鼠标，同旧版） */
  setGaze(lx: number, ly: number, rx: number, ry: number) {
    this.gazeL = [lx, ly]
    this.gazeR = [rx, ry]
    this.draw()
  }

  /** 眼睑色（CatFace palette，随主题更新；hex → [r,g,b] 字节） */
  setFurColors(fur: string, furEdge: string) {
    const parse = (hex: string): [number, number, number] => {
      const h = hex.replace('#', '')
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    }
    this.fur = parse(fur)
    this.furEdge = parse(furEdge)
  }

  /** 瞳孔色（CatFace palette.pupil，随主题更新；hex → [r,g,b] 字节） */
  setPupilColor(pupil: string) {
    const h = pupil.replace('#', '')
    this.pupilCol = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }

  /** 拉取头像并栅格化为纹理（背面碗滚动显示）；CORS/加载失败 → 兜底纹理（纯色圆 + accent 描边 + Y 字标） */
  setAvatarUrl(url: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (this.disposed || !this.gl) return
      this.avatarReady = true
      this.lastTexSrc = img
      this.uploadTexture(img)
      this.draw()
    }
    img.onerror = () => {
      if (this.disposed || !this.gl) return
      this.avatarReady = false
      this.uploadFallbackTexture()
      this.draw()
    }
    img.src = url
  }

  private uploadTexture(src: TexImageSource) {
    const gl = this.gl
    if (!gl || !this.tex) return
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    // 不翻转：v=0 对应图像首行（顶部），与 y 向下的局部坐标 uv 映射一致
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  }

  /** 兜底头像：2D canvas 画「纯色圆 + accent 描边 + Y 字标」后上传（配色随主题重建） */
  private uploadFallbackTexture() {
    const f = this.face
    if (!f) return
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const g = c.getContext('2d')
    if (!g) return
    const css = (v: RGBA) => `rgba(${v[0]},${v[1]},${v[2]},${v[3]})`
    g.fillStyle = css(f.bg)
    g.beginPath()
    g.arc(256, 256, 256, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = css(f.accent)
    g.lineWidth = 14
    g.beginPath()
    g.arc(256, 256, 249, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = css(f.accent)
    g.font = '700 220px Archivo, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('Y', 256, 276)
    this.lastTexSrc = c
    this.uploadTexture(c)
  }

  setFaceColors(c: FaceColors) {
    this.face = c
    // 头像未就绪期间随主题重建兜底纹理，保证兜底圆配色跟主题
    if (this.gl && !this.avatarReady) this.uploadFallbackTexture()
  }

  setSidePalette(layers: LayerSpec[]) {
    this.layers = layers
  }

  /** 徽章实测直径 css px（canvas 背板 = 直径 × CANVAS_MARGIN × dpr） */
  setSize(cssDiameter: number) {
    this.cssSize = cssDiameter
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    const px = Math.round(cssDiameter * CANVAS_MARGIN * dpr)
    if (px <= 0) return
    this.canvas.width = px
    this.canvas.height = px
    this.canvas.style.width = `${cssDiameter * CANVAS_MARGIN}px`
    this.canvas.style.height = `${cssDiameter * CANVAS_MARGIN}px`
  }

  setRotation(rx: number, ry: number) {
    this.rx = rx
    this.ry = ry
  }

  private lightAng = 2.19 // 光源角 rad（世界系；默认左上，组件按现实时间更新）
  private lightK = 1 // 光源强度（日 1 / 夜 0.35）
  private bowlShA = 0.15 // 碗面内凹阴影强度（浅 0.15 / 暗 0.34）

  /** 日光轨：光源角 + 强度（组件每分钟按现实时间刷新，晨昏平滑过渡） */
  setLight(ang: number, k: number) {
    this.lightAng = ang
    this.lightK = k
    this.draw()
  }

  /** 碗面内凹阴影强度（随主题：浅 0.15 / 暗 0.34） */
  setBowlShadow(a: number) {
    this.bowlShA = a
    this.draw()
  }

  /** 矩阵 M = Rx·Ry（列向量先 Ry 后 Rx），column-major；M22 = cx·cy 用于深度排序 */
  private rotMat(): Float32Array {
    const ax = (this.rx * Math.PI) / 180
    const ay = (this.ry * Math.PI) / 180
    const cx = Math.cos(ax), sx = Math.sin(ax)
    const cy = Math.cos(ay), sy = Math.sin(ay)
    // 列主序：col0(M00,M10,M20) col1(M01,M11,M21) col2(M02,M12,M22)
    return new Float32Array([
      cy, sx * sy, -cx * sy,
      0, cx, sx,
      sy, -sx * cy, cx * cy,
    ])
  }

  /**
   * 状态变更入口：只置脏排队，同一同步块内合并为一次真实绘制。
   * 一次 mousemove 会连发 8 个 quickTo × 4 setter = 32 次 draw()——其中
   * 中间状态从不被 paint（浏览器只读帧末 uniform），全绘是纯浪费；
   * microtask 在 paint 前必然执行 → 视觉零差异，主线程/GPU 负载降 ~97%。
   * 需要同步绘制的调用点（如 setSize 后立即测量）不受影响：微任务在当前
   * 同步块结束后立刻执行，任何跨进程观察者（截图/合成器）都读到新帧。
   */
  draw() {
    if (this.disposed || this.drawQueued) return
    const gl = this.gl
    if (!gl) return
    this.drawQueued = true
    queueMicrotask(() => {
      this.drawQueued = false
      this.flush()
    })
  }

  /** 真实绘制（draw() 的微任务 flush 目标） */
  private flush() {
    const gl = this.gl
    if (!gl || !this.program || this.cssSize <= 0 || !this.face || this.disposed) return
    const m = this.rotMat()
    const R = this.cssSize / 2
    const half = R * CANVAS_MARGIN
    const f = this.face

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    gl.uniformMatrix3fv(this.loc.u_rot!, false, m)
    gl.uniform1f(this.loc.u_cosRy!, Math.cos((this.ry * Math.PI) / 180))
    gl.uniform2f(this.loc.u_light!, this.lightAng, this.lightK)
    gl.uniform1f(this.loc.u_bowlShA!, this.bowlShA)
    gl.uniform1f(this.loc.u_d!, PERSPECTIVE_D)
    gl.uniform1f(this.loc.u_half!, half)
    gl.uniform4f(this.loc.u_base!, ...norm(f.base))
    gl.uniform4f(this.loc.u_hi!, ...norm(f.hi))
    gl.uniform4f(this.loc.u_border!, ...norm(f.border))
    gl.uniform4f(this.loc.u_glowIn!, ...norm(f.glowInner))
    gl.uniform4f(this.loc.u_accent!, ...norm(f.accentSoft))
    gl.uniform4f(this.loc.u_inset!, ...norm(f.badgeInset))
    gl.uniform1f(this.loc.u_px!, 1 / (R * SHRINK))
    gl.uniform1f(this.loc.u_bowl!, BOWL_RATIO / SHRINK)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.uniform1i(this.loc.u_tex!, 0)
    // unit1：正面猫脸中性帧 + 微表情因子
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.faceTex)
    gl.uniform1i(this.loc.u_faceTex!, 1)
    gl.uniform1f(this.loc.u_closed!, this.closed)
    gl.uniform2f(this.loc.u_gazeL!, this.gazeL[0], this.gazeL[1])
    gl.uniform2f(this.loc.u_gazeR!, this.gazeR[0], this.gazeR[1])
    // unit2：耳朵变体帧 + 瞳孔因子（程序化）+ 头部微倾
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.earTex)
    gl.uniform1i(this.loc.u_earTex!, 2)
    gl.uniform1f(this.loc.u_earBlend!, this.earBlend)
    gl.uniform1f(this.loc.u_pupilBlend!, this.pupilBlend)
    gl.uniform1f(this.loc.u_faceRot!, this.faceRot)
    gl.uniform2f(this.loc.u_faceTilt!, this.faceTilt[0], this.faceTilt[1])
    gl.uniform3f(this.loc.u_fur!, this.fur[0] / 255, this.fur[1] / 255, this.fur[2] / 255)
    gl.uniform3f(this.loc.u_furEdge!, this.furEdge[0] / 255, this.furEdge[1] / 255, this.furEdge[2] / 255)
    gl.uniform3f(this.loc.u_pupilCol!, this.pupilCol[0] / 255, this.pupilCol[1] / 255, this.pupilCol[2] / 255)

    // painter's algorithm：世界系 z 升序（远 → 近）
    type Item = { wz: number; z: number; radius: number; kind: 0 | 1 | 2; color?: RGBA }
    const items: Item[] = []
    const T = BASE_EDGE_T * (this.cssSize / BASE_D) // 侧壁厚度随直径等比
    items.length = 0
    for (const L of this.layers) {
      const z = L.zF * T
      items.push({ wz: m[8] * z, z, radius: R * L.radiusF, kind: 0, color: L.colorF })
    }
    items.push({ wz: m[8] * (T / 2), z: T / 2, radius: R * SHRINK, kind: 1 })
    items.push({ wz: m[8] * (-T / 2), z: -T / 2, radius: R * SHRINK, kind: 2 })
    items.sort((a, b) => a.wz - b.wz)

    for (const it of items) {
      gl.uniform1f(this.loc.u_mode!, it.kind)
      gl.uniform1f(this.loc.u_radius!, it.radius)
      gl.uniform1f(this.loc.u_z!, it.z)
      if (it.kind === 0) {
        gl.uniform4f(this.loc.u_color!, ...norm(it.color!))
      } else {
        // 正面高光中心 30%/22%，背面镜像 70%/22%
        gl.uniform2f(this.loc.u_hiC!, it.kind === 1 ? -0.4 : 0.4, -0.56)
      }
      gl.drawArrays(gl.TRIANGLE_FAN, 0, SEGMENTS + 2)
    }
  }

  dispose() {
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.handleLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleRestored)
    // 主动丢上下文，尽快释放移动端宝贵的 GL 资源
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.gl = null
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[badge-gl] shader compile failed:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function createProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const v = compileShader(gl, gl.VERTEX_SHADER, vs)
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs)
  if (!v || !f) return null
  const p = gl.createProgram()
  if (!p) return null
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[badge-gl] program link failed:', gl.getProgramInfoLog(p))
    return null
  }
  return p
}
