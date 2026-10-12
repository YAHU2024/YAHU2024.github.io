// B2 交互迁移验证：拖拽跟手/惯性归位/键盘翻转/spin 转场/昼夜联动
// 用法：node scripts/verify-badge-b2.mjs [url]   （默认 http://localhost:4175/）
// 依赖本机 Chrome/Edge（headless CDP）。输出「状态 + 证据」汇总表。
// 姿态证据采用像素特征（canvas 架构无 DOM 覆盖层可读）：
//   - 黄色眼白计数：正面猫脸可见度（翻转出视野 → 骤降）
//   - 粉色像素计数：背面头像可见度
//   - 帧间平均差：spin 转场运动检测（与静止抖动基线对比）
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const URL_BASE = process.argv[2] || 'http://localhost:4175/'
const OUT_DIR = path.resolve('docs/b2-shots')
fs.mkdirSync(OUT_DIR, { recursive: true })

const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))
if (!browser) {
  console.error('未找到 Chrome / Edge')
  process.exit(1)
}

// ── PNG 解码（8-bit RGB/RGBA 非交错，Chrome 导出格式）──
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
/** 帧间平均绝对差（0-255/通道） */
function meanDiff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return NaN
  let sum = 0
  const n = a.width * a.height
  for (let i = 0; i < n; i++) {
    const o = i * a.bpp
    sum += Math.abs(a.img[o] - b.img[o]) + Math.abs(a.img[o + 1] - b.img[o + 1]) + Math.abs(a.img[o + 2] - b.img[o + 2])
  }
  return sum / (n * 3)
}
/** 颜色特征计数：yellow = 正面猫眼/星标；pink = 背面头像/猫耳鼻 */
function countColor(d, test) {
  let c = 0
  for (let i = 0; i < d.width * d.height; i++) {
    const o = i * d.bpp
    if (test(d.img[o], d.img[o + 1], d.img[o + 2])) c++
  }
  return c
}
const isYellow = (r, g, b) => r > 150 && g > 100 && b < 110 && r > g && g > b
const isPink = (r, g, b) => r > 170 && g > 90 && g < 180 && b > 90 && b < 190 && r - g > 50

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-b2-'))
const proc = spawn(
  browser,
  [
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--headless=new',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
const wsUrl = await new Promise((res, rej) => {
  let b = ''
  proc.stderr.on('data', (d) => {
    b += d
    const m = b.match(/DevTools listening on (ws:\/\/\S+)/)
    if (m) res(m[1])
  })
  setTimeout(() => rej(new Error('Chrome 启动超时')), 15000)
})
const port = new URL(wsUrl).port
const res = await fetch(`http://127.0.0.1:${port}/json/new?url=about:blank`, { method: 'PUT' })
const target = await res.json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r, j) => {
  ws.onopen = r
  ws.onerror = j
})
let msgId = 0
const pending = new Map()
const listeners = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result)
    pending.delete(m.id)
    return
  }
  if (m.method && listeners.has(m.method)) listeners.get(m.method).forEach((fn) => fn(m.params))
}
const send = (method, params = {}) => {
  const id = ++msgId
  return new Promise((resolve) => {
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
}
const evalValue = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails)
    throw new Error('页面脚本异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  return r.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 截取 .cat-stage 区域并解码（徽章运动/特征统计都在这一区域内） */
const snapStage = async (name) => {
  const rect = await evalValue(`(() => {
    const r = document.querySelector('.cat-stage').getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })()`)
  const s = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 2 },
  })
  const buf = Buffer.from(s.data, 'base64')
  if (name) fs.writeFileSync(path.join(OUT_DIR, name), buf)
  return decodePng(buf)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 2,
  mobile: false,
})
const done = new Promise((r) => listeners.set('Page.loadEventFired', [r]))
await send('Page.navigate', { url: URL_BASE })
await done
await sleep(3000)

const results = []
const check = (name, ok, evidence) => results.push({ name, ok, evidence })

// ── 0. 前置：WebGL 分支激活（canvas 存在且非 2D 兜底） ──
const pre = await evalValue(`({
  canvas: !!document.querySelector('.badge-canvas'),
  fallback: !!document.querySelector('.badge2d'),
  d3: !!document.querySelector('.badge3d'),
})`)
check('WebGL 分支激活', pre.canvas && pre.d3 && !pre.fallback, `canvas=${pre.canvas} badge3d=${pre.d3} fallback=${pre.fallback}`)

// ── 基线：静止多帧（悬浮 bob 噪声底 + 避开眨眼帧）+ 正面特征计数 ──
const restA = await snapStage()
const restB = await snapStage('rest.png')
const restC = await snapStage()
const restMotion = meanDiff(restA, restB)
// 基线帧可能恰好截到眨眼（眼白骤降）→ 取多帧中黄色计数最大者作为正面基线
const yellowOf = (d) => countColor(d, isYellow)
const restYellow = Math.max(yellowOf(restA), yellowOf(restB), yellowOf(restC))
const restPink = countColor(restB, isPink)

// ── 1. 拖拽跟手：mousedown → 分步右移 220px（ry≈132°，正面转出视野）→ 截图 ──
const box = await evalValue(`(() => {
  const r = document.querySelector('.badge3d').getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})()`)
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
const steps = 8
for (let i = 1; i <= steps; i++) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: box.x + (220 * i) / steps, y: box.y, button: 'left',
  })
  await sleep(16)
}
await sleep(120) // 等 rAF 应用
const dragShot = await snapStage('drag-mid.png')
const dragYellow = countColor(dragShot, isYellow)
const dragPink = countColor(dragShot, isPink)
// 「正面在场」= 黄（眼白）与粉（鼻/耳）同时落在基线带内。
// 背面两种纹理（头像：黄≈0/粉高；Y 兜底：黄极高/粉≈0）都不会误判为正面
// （头像 CDN 偶发 403 时背面落 Y 兜底，属环境抖动而非回归）
const frontLike =
  dragYellow > restYellow * 0.75 && dragYellow < restYellow * 1.3 &&
  dragPink > restPink * 0.75 && dragPink < restPink * 1.3
check(
  '拖拽跟手（+220px 翻过 90°，正面猫脸转出视野）',
  !frontLike,
  `黄 ${dragYellow}（基线 ${restYellow} 的 ${((dragYellow / restYellow) * 100).toFixed(0)}%）、粉 ${dragPink}（基线 ${restPink} 的 ${((dragPink / restPink) * 100).toFixed(0)}%），drag-mid.png`,
)

// ── 2. 惯性归位：松手 → 等 1.8s → 正面特征恢复 ──
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + 220, y: box.y, button: 'left', clickCount: 1 })
await sleep(1800)
const restShot = await snapStage('rest-after-drag.png')
const backYellow = countColor(restShot, isYellow)
check(
  '松手惯性归位（正面猫脸回到视野）',
  backYellow > restYellow * 0.8,
  `黄色眼白 ${backYellow} / 基线 ${restYellow}（${((backYellow / restYellow) * 100).toFixed(0)}%），rest-after-drag.png`,
)

// ── 3. 键盘翻转：focus → Enter → 背面头像（粉色骤增）→ 再 Enter 回正面 ──
await evalValue(`document.querySelector('.badge3d').focus()`)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
await sleep(1100)
const backShot = await snapStage('keyboard-back.png')
const backPink = countColor(backShot, isPink)
check(
  '键盘 Enter 翻到背面（头像可见，粉色骤增）',
  backPink > restPink * 1.5,
  `粉色 ${backPink} / 正面基线 ${restPink}（${(restPink ? (backPink / restPink) * 100 : 0).toFixed(0)}%），keyboard-back.png`,
)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
await sleep(1100)
const frontShot = await snapStage('keyboard-front.png')
const frontYellow = countColor(frontShot, isYellow)
check(
  '键盘再按回正面（猫脸恢复）',
  frontYellow > restYellow * 0.8,
  `黄色眼白 ${frontYellow} / 基线 ${restYellow}（${((frontYellow / restYellow) * 100).toFixed(0)}%），keyboard-front.png`,
)

// ── 4. spin：点击导航「最近」触发视图切换转场（内容淡出 + 徽章 back.out 旋转前载，
//        可见窗口 ~80-400ms 且与淡出重叠）→ 转场早期帧与静止基线差分 → 完成后正面特征恢复 ──
const clicked = await evalValue(`(() => {
  const links = [...document.querySelectorAll('nav a, nav button')]
  const target = links.find((el) => el.textContent.trim() === '最近')
  if (!target) return false
  target.click()
  return true
})()`)
await sleep(180) // 转场 .call(spin) 在 0.08s，back.out 前载旋转集中在 ~80-400ms
const spinShot = await snapStage('spin-mid.png')
const spinDiff = meanDiff(spinShot, restB)
await sleep(2800) // 等转场淡出/回显 + 装饰受扰弹性全部结束
let endShot = await snapStage('spin-end.png')
let endYellow = countColor(endShot, isYellow)
if (endYellow < restYellow * 0.8) {
  // 眨眼恰好被截到的兜底：眼白骤降重拍一次
  await sleep(400)
  endShot = await snapStage('spin-end.png')
  endYellow = countColor(endShot, isYellow)
}
check(
  'spin 转场触发（转场早期相对静止基线变化显著）',
  clicked && spinDiff > Math.max(restMotion * 4, 1.5),
  `clicked=${clicked}，转场帧差 ${spinDiff.toFixed(2)} / 静止噪声底 ${restMotion.toFixed(2)}，spin-mid.png`,
)
check(
  'spin 完成归零（正面猫脸回到视野）',
  endYellow > restYellow * 0.8,
  `黄色眼白 ${endYellow} / 基线 ${restYellow}（${((endYellow / restYellow) * 100).toFixed(0)}%），spin-end.png`,
)

// ── 5. 昼夜联动：点击 ThemeToggle（aria-label 含 深色/浅色/dark/light）→ 等 750ms → 以 dataset.theme 变化为证据 ──
const themeResult = await evalValue(`(async () => {
  const before = document.documentElement.dataset.theme
  const btn = [...document.querySelectorAll('button')].find((b) => {
    const a = b.getAttribute('aria-label') || ''
    return /深色|浅色|dark|light/i.test(a)
  })
  if (!btn) return { found: false }
  btn.click()
  await new Promise((r) => setTimeout(r, 750))
  const after = document.documentElement.dataset.theme
  return { found: true, before, after }
})()`)
if (themeResult?.found) {
  await snapStage('theme-after.png')
  check(
    '昼夜联动（侧壁色板/面片配色 450ms 插值切换）',
    themeResult.before !== themeResult.after,
    `theme: ${themeResult.before} → ${themeResult.after}，theme-after.png 已产出`,
  )
} else {
  check('昼夜联动', false, '未找到主题切换按钮，需人工验证')
}

// ── 汇总 ──
console.log(`\n基线：静止帧差 ${restMotion.toFixed(2)}，黄色 ${restYellow}，粉色 ${restPink}`)
console.log('\n════ B2 交互迁移验证 ════')
let fail = 0
for (const r of results) {
  if (!r.ok) fail++
  console.log(`${r.ok ? '✅' : '❌'} ${r.name} — ${r.evidence}`)
}
console.log(`\n${results.length - fail}/${results.length} 通过；截图在 ${OUT_DIR}`)
proc.kill()
process.exit(fail ? 1 : 0)
