// 融合架构 v2 验证：直立方向 / 变体帧差异区域 / 眨眼
// node scripts/_verify-face-v2.mjs [outDir]  （默认 $TEMP/face-v2）
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT_DIR = process.argv[2] || path.join(os.tmpdir(), 'face-v2')
const URL_BASE = process.argv[3] || 'http://localhost:4175/'
fs.mkdirSync(OUT_DIR, { recursive: true })

// ── PNG 解码 + 颜色统计（与 px-probe 同款反滤波）──
function decodePng(buf) {
  let pos = 8
  let width = 0, height = 0, bitDepth = 0, colorType = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      bitDepth = data[8]; colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const img = Buffer.alloc(height * stride)
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  let rp = 0
  for (let y = 0; y < height; y++) {
    const ft = raw[rp++]
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp++]
      const left = x >= bpp ? img[row + x - bpp] : 0
      const up = y > 0 ? img[row - stride + x] : 0
      const ul = y > 0 && x >= bpp ? img[row - stride + x - bpp] : 0
      let v = cur
      if (ft === 1) v = cur + left
      else if (ft === 2) v = cur + up
      else if (ft === 3) v = cur + ((left + up) >> 1)
      else if (ft === 4) v = cur + paeth(left, up, ul)
      img[row + x] = v & 0xff
    }
  }
  return { img, width, height, bpp }
}
const isYellow = (r, g, b) => r > 150 && g > 100 && b < 110 && r > g && g > b
const isPink = (r, g, b) => r > 170 && g > 90 && g < 180 && b > 90 && b < 190 && r - g > 50
function stats(d) {
  let ySum = 0, yN = 0, yCount = 0
  let noseSum = 0, noseN = 0
  let earTopN = 0, earBotN = 0
  const { img, width: W, height: H, bpp } = d
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * bpp
      const r = img[o], g = img[o + 1], b = img[o + 2]
      if (isYellow(r, g, b)) { ySum += y; yN++; yCount++ }
      if (isPink(r, g, b)) {
        const fx = x / W, fy = y / H
        // 中央竖带（鼻尖区，避开左右耳）
        if (fx > 0.42 && fx < 0.58 && fy > 0.2 && fy < 0.75) { noseSum += y; noseN++ }
        // 耳内粉色：上左右象限 vs 下左右象限（x 避开中央带）
        if (fx > 0.22 && fx < 0.42 || fx > 0.58 && fx < 0.78) {
          if (fy > 0.12 && fy < 0.45) earTopN++
          if (fy > 0.55 && fy < 0.88) earBotN++
        }
      }
    }
  }
  return {
    yellow: yCount,
    eyeY: yN ? ySum / yN : -1,
    noseY: noseN ? noseSum / noseN : -1,
    noseN,
    earTopN,
    earBotN,
  }
}

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fv2-'))
const proc = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--remote-debugging-port=0', `--user-data-dir=${profileDir}`, '--no-first-run', '--hide-scrollbars', '--headless=new', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
const wsUrl = await new Promise((res, rej) => {
  let b = ''
  proc.stderr.on('data', (d) => {
    b += d
    const m = b.match(/DevTools listening on (ws:\/\/\S+)/)
    if (m) res(m[1])
  })
  setTimeout(() => rej(new Error('timeout')), 15000)
})
const port = new URL(wsUrl).port
const res = await fetch(`http://127.0.0.1:${port}/json/new?url=about:blank`, { method: 'PUT' })
const target = await res.json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
}
const send = (method, params = {}) => {
  const i = ++id
  return new Promise((r) => { pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
}
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shotStage = async (file) => {
  const rect = await ev(`(() => { const r = document.querySelector('.cat-stage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()`)
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 2 } })
  const buf = Buffer.from(s.data, 'base64')
  if (file) fs.writeFileSync(path.join(OUT_DIR, file), buf)
  return buf
}

await send('Page.enable')
// 固定浅色主题：脚本按浅色板（粉鼻/粉耳）做像素判定，主题必须与环境无关地确定为 light
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('theme','light')}catch(e){}" })
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false })
await send('Page.navigate', { url: URL_BASE })
await sleep(3500)

const results = []
const check = (name, ok, evidence) => results.push({ name, ok, evidence })

// ── 1. 直立方向：鼻尖（中央带粉色）应在眼黄下方；耳内粉色应在上部 ──
const restBuf = await shotStage('1-upright-rest.png')
const st = stats(decodePng(restBuf))
check(
  '正面猫脸直立（鼻尖在眼下方）',
  st.noseN > 200 && st.noseY > st.eyeY,
  `眼黄质心 y=${st.eyeY.toFixed(0)}，鼻尖质心 y=${st.noseY.toFixed(0)}（nose 像素 ${st.noseN}），1-upright-rest.png`,
)
check(
  '耳朵在头顶（耳内粉色上 > 下）',
  st.earTopN > st.earBotN * 1.5,
  `上部耳粉 ${st.earTopN} / 下部耳粉 ${st.earBotN}`,
)

// ── 2. 变体帧差异区域（SVG 级检验：耳变体差异限耳区、瞳孔变体差异限眼区）──
const variantCheck = await ev(`(async () => {
  const svg = document.querySelector('.badge-face-host svg')
  if (!svg) return { error: 'no svg' }
  const serialize = (mutate) => {
    svg.querySelectorAll('[data-lid="top"]').forEach((el) => el.setAttribute('transform', 'translate(0, -20)'))
    svg.querySelectorAll('[data-lid="bottom"]').forEach((el) => el.setAttribute('transform', 'translate(0, 20)'))
    const clone = svg.cloneNode(true)
    mutate?.(clone)
    let xml = new XMLSerializer().serializeToString(clone)
    if (!xml.includes('xmlns=')) xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    xml = xml.replace('<svg', '<svg width="200" height="200"')
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  }
  const load = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
  const draw = (img) => { const c = document.createElement('canvas'); c.width = c.height = 200; c.getContext('2d').drawImage(img, 0, 0, 200, 200); return c }
  const diff = (a, b) => {
    const ga = a.getContext('2d').getImageData(0, 0, 200, 200).data
    const gb = b.getContext('2d').getImageData(0, 0, 200, 200).data
    let n = 0, minX = 999, maxX = -1, minY = 999, maxY = -1
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
      const o = (y * 200 + x) * 4
      if (Math.abs(ga[o] - gb[o]) > 12 || Math.abs(ga[o+1] - gb[o+1]) > 12 || Math.abs(ga[o+2] - gb[o+2]) > 12) {
        n++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
    }
    return { n, minX, maxX, minY, maxY }
  }
  const neutral = draw(await load(serialize(null)))
  const earL = draw(await load(serialize((c) => c.querySelector('[data-ear="left"]')?.setAttribute('transform', 'rotate(4 71 64)'))))
  return {
    ear: diff(neutral, earL),
    earNeutral: neutral.toDataURL().length,
  }
})()`)
if (variantCheck?.error) {
  check('变体帧差异区域', false, variantCheck.error)
} else {
  const e = variantCheck.ear
  // 耳变体：差异应集中在上半（耳区 y<80），且非全图
  check(
    '耳抖变体帧（差异限左耳区）',
    e.n > 20 && e.n < 4000 && e.minY < 80 && e.maxY < 110,
    `diff ${e.n}px，bbox x[${e.minX},${e.maxX}] y[${e.minY},${e.maxY}]（耳根 y≈64）`,
  )
  // 瞳孔已程序化（纹理中 [data-pupil] 隐藏），放大改为实时悬停检测，见下方 2.2
}

// ── 2.2 瞳孔放大（实时）：悬停徽章中心 → 程序化瞳孔 k=1.14，眼黄像收缩 ≈5.4% ──
{
  const badgeC = await ev(`(() => { const b = document.querySelector('.badge3d').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: badgeC.x, y: badgeC.y })
  // 度量：瞳孔放大遮住眼白 → 眼黄像素收缩（理论 ≈5.4%）。眼黄计数不受
  // bbox 角部毛底污染（毛色 #2f2f3a 会命中暗色阈值，面积比被稀释到 1.10）。
  // 悬停浮起只平移不改黄像素数；眨眼会暴跌 → 检出则等恢复重拍（最多 3 次）
  const countYellow = (d) => {
    let n = 0
    const yLim = (d.height * 0.6) | 0
    for (let y = 0; y < yLim; y++) {
      for (let x = 0; x < d.width; x++) {
        const o = (y * d.width + x) * d.bpp
        if (isYellow(d.img[o], d.img[o + 1], d.img[o + 2])) n++
      }
    }
    return n
  }
  const restD0 = decodePng(restBuf)
  const yRest = countYellow(restD0)
  let yDil = -1, dilD = null
  for (let t = 0; t < 3; t++) {
    await sleep(t === 0 ? 800 : 1500)
    dilD = decodePng(await shotStage(t === 0 ? '4-dilate.png' : `4-dilate-${t}.png`))
    yDil = countYellow(dilD)
    if (yDil >= yRest * 0.9) break
  }
  const drop = yRest > 0 ? 1 - yDil / yRest : -1
  check(
    '瞳孔放大（悬停实时，程序化 1.14×）',
    drop > 0.03 && drop < 0.09,
    `眼黄像 rest=${yRest} → dilate=${yDil}（收缩 ${(drop * 100).toFixed(1)}%，理论 ≈5.4%），4-dilate.png`,
  )
}

// ── 2.5 视线专项：鼠标远端右侧 → 瞳孔在眼白内位移（暗色质心右移），脸其余部分不动 ──
// （修复回归点：旧实现整体平移脸 → 感知幅度过大且瞳孔无视差）
function darkCentroidInBbox(d, bx0, by0, bx1, by1) {
  // 四周腐蚀 24px（≈3 SVG 单位）：完全落入眼白内，排除眼眶描边环与 bbox 角部毛色
  const ex = 24, ey = 24
  let sx = 0, n = 0
  for (let y = Math.max(0, (by0 + ey) | 0); y < Math.min(d.height, (by1 - ey) | 0); y++) {
    for (let x = Math.max(0, (bx0 + ex) | 0); x < Math.min(d.width, (bx1 - ex) | 0); x++) {
      const o = (y * d.width + x) * d.bpp
      const r = d.img[o], g = d.img[o + 1], b = d.img[o + 2]
      if (r < 70 && g < 70 && b < 90) { sx += x; n++ }
    }
  }
  return n > 30 ? sx / n : -1
}
function yellowBbox(d, x0, x1, yMax) {
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
  const yLim = Math.min(d.height, yMax | 0)
  for (let y = 0; y < yLim; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * d.width + x) * d.bpp
      if (isYellow(d.img[o], d.img[o + 1], d.img[o + 2])) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, maxX, minY, maxY }
}
function noseCentroidX(d) {
  let sx = 0, n = 0
  const { img, width: W, height: H, bpp } = d
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * bpp
      if (isPink(img[o], img[o + 1], img[o + 2])) {
        const fx = x / W, fy = y / H
        // 收紧到鼻尖本体（SVG 92-108 → fx 0.46-0.54），避开左耳内粉（可延伸到 fx≈0.44）
        if (fx > 0.46 && fx < 0.54 && fy > 0.2 && fy < 0.75) { sx += x; n++ }
      }
    }
  }
  return n > 200 ? sx / n : -1
}
// 目标点选在 .cat-stage 外 → 不触发悬停浮动/视差/瞳孔放大，只有 window 级视线+头倾生效
const stageBox = await ev(`(() => { const r = document.querySelector('.cat-stage').getBoundingClientRect(); const b = document.querySelector('.badge3d').getBoundingClientRect(); return { sr: r.right, cy: b.top + b.height / 2, vw: innerWidth, vh: innerHeight } })()`)
const gazeX = Math.min(stageBox.sr + 60, stageBox.vw - 20)
const gazeY = Math.min(stageBox.cy, stageBox.vh - 20)
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: gazeX, y: gazeY, button: 'left' })
await sleep(1200)
const gazeBuf = await shotStage('3-gaze-right.png')
const gazeD = decodePng(gazeBuf)
const restD = decodePng(restBuf)
// 右眼眼白 bbox 逐帧独立测（头倾会整体移脸，跨帧复用 bbox 会引入错位偏差），
// y 限眼带高度排除右下角星星，腐蚀后只含眼白 → 暗色 = 瞳孔本体
const ybRest = yellowBbox(restD, (restD.width / 2) | 0, restD.width, restD.height * 0.6)
const ybGaze = yellowBbox(gazeD, (gazeD.width / 2) | 0, gazeD.width, gazeD.height * 0.6)
const pupilRest = darkCentroidInBbox(restD, ybRest.minX - 4, ybRest.minY - 4, ybRest.maxX + 4, ybRest.maxY + 4)
const pupilGaze = darkCentroidInBbox(gazeD, ybGaze.minX - 4, ybGaze.minY - 4, ybGaze.maxX + 4, ybGaze.maxY + 4)
const noseXRest = noseCentroidX(restD)
const noseXGaze = noseCentroidX(gazeD)
check(
  '视线（瞳孔在眼白内朝鼠标位移）',
  pupilRest > 0 && pupilGaze > 0 && pupilGaze - pupilRest > 3,
  `右眼暗色质心 x：${pupilRest.toFixed(1)} → ${pupilGaze.toFixed(1)}（+${(pupilGaze - pupilRest).toFixed(1)}px @2x），3-gaze-right.png`,
)
check(
  '视线（脸不再随鼠标整体平移，仅余头倾分量）',
  noseXRest > 0 && noseXGaze > 0 && Math.abs(noseXGaze - noseXRest) < 15,
  `鼻尖质心 x：${noseXRest.toFixed(1)} → ${noseXGaze.toFixed(1)}（Δ${(noseXGaze - noseXRest).toFixed(1)}px；旧整体平移 bug ≈+41px，仅头倾 ≈+5px @4x）`,
)
// 复位鼠标到远角（reach 饱和且远离徽章），避免影响后续眨眼连拍
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 15, y: stageBox.vh - 15, button: 'left' })
await sleep(800)

// ── 3. 眨眼：先连拍（不做解码，采样间隔最短）再离线统计，黄色眼白骤降 = 眼睑开合生效。
//         全闭窗口仅 ~40ms（闭合 85ms 的谷底），捕获是概率事件 → 预算拉满 240 帧，抓到深谷即停 ──
const burst = []
let minYellow = Infinity
let minFrame = -1
for (let i = 0; i < 240; i++) {
  const buf = await shotStage(i === 0 ? '2-blink-open.png' : null)
  burst.push(buf)
  await sleep(40)
  if (i % 20 === 19 || i === 239) {
    // 每 20 帧离线解码一次已捕获帧，命中深谷提前结束
    for (let j = burst.length - Math.min(20, burst.length); j < burst.length; j++) {
      const y = stats(decodePng(burst[j])).yellow
      if (y < minYellow) { minYellow = y; minFrame = j }
    }
    if (minYellow < st.yellow * 0.35) break
  }
}
if (minYellow < st.yellow * 0.35) {
  fs.writeFileSync(path.join(OUT_DIR, '2-blink-closed.png'), burst[minFrame])
}
check(
  '眨眼（眼睑开合捕获）',
  minYellow < st.yellow * 0.35,
  `睁眼基线 ${st.yellow} → 最低 ${minYellow}（第 ${minFrame} 帧，${((minYellow / st.yellow) * 100).toFixed(0)}%），2-blink-closed.png`,
)

console.log('\n════ 融合架构 v2 验证 ════')
let fail = 0
for (const r of results) {
  if (!r.ok) fail++
  console.log(`${r.ok ? '✅' : '❌'} ${r.name} — ${r.evidence}`)
}
console.log(`\n${results.length - fail}/${results.length} 通过；截图在 ${OUT_DIR}`)
proc.kill()
process.exit(fail ? 1 : 0)
