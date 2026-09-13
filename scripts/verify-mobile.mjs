// 移动端修复验证（零依赖）：本地 Chrome headless + CDP（Node 22 内置 WebSocket）
//
//   node scripts/verify-mobile.mjs [输出目录]
//
// 模拟移动设备（390×844 / DPR 3 / 触屏 → hover:none 媒体环境），
// 逐项验证三个修复：
//   1. 页面卡顿  → blob::before 冻结 / glass backdrop 关闭 / CPU 4x 降速测帧率
//   2. 文字闪烁  → 同上（重绘源消除后同屏 A/B 对比帧率）
//   3. 徽章残缺  → 触屏层数 16 / will-change auto / backdrop none / 截图目视猫脸
// A/B：注入样式还原修复前的开销（blob 交叉动画 + glass/badge backdrop），
//       同环境复测帧率，给出对比数字。不下载任何依赖。
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const OUT_DIR =
  process.argv[2] || path.join(os.tmpdir(), 'yahu-verify')

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const URL_BASE = process.env.VERIFY_URL || 'http://127.0.0.1:4173'

const browser = BROWSERS.find((p) => fs.existsSync(p))
if (!browser) {
  console.error('未找到 Chrome / Edge')
  process.exit(1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })

// ── 启动 headless Chrome ──
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-profile-'))
const proc = spawn(
  browser,
  [
    '--headless=new',
    `--remote-debugging-port=0`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--disable-gpu', // 强制软件渲染：模拟弱 GPU 移动设备，让 blur 重绘开销可测量
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)

const wsUrlFromStderr = await new Promise((resolve, reject) => {
  let buf = ''
  const timer = setTimeout(() => reject(new Error('Chrome 启动超时')), 15000)
  proc.stderr.on('data', (d) => {
    buf += d.toString()
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/)
    if (m) {
      clearTimeout(timer)
      resolve(m[1])
    }
  })
  proc.on('exit', () => reject(new Error('Chrome 提前退出: ' + buf)))
})

// 浏览器级 ws → 提取端口 → PUT /json/new 建页面级 target
const port = new URL(wsUrlFromStderr).port
const res = await fetch(`http://127.0.0.1:${port}/json/new?url=about:blank`, {
  method: 'PUT',
})
const target = await res.json()

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let msgId = 0
const pending = new Map()
const listeners = new Map() // method -> [fn]
const consoleErrors = []

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
    return
  }
  if (msg.method) {
    if (msg.method === 'Runtime.exceptionThrown')
      consoleErrors.push(msg.params.exceptionDetails?.text ?? 'exception')
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error')
      consoleErrors.push(`${msg.params.entry.source}: ${msg.params.entry.text}`)
    const fns = listeners.get(msg.method)
    if (fns) fns.forEach((fn) => fn(msg.params))
  }
}

function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
/** evaluate + returnByValue，异常时透出页面侧报错而非 undefined */
async function evalValue(expression, awaitPromise = false) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
  })
  if (r.exceptionDetails)
    throw new Error('页面脚本异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  return r.result?.value
}
function once(method, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('等待事件超时: ' + method)), timeoutMs)
    listeners.set(method, [
      (p) => {
        clearTimeout(t)
        listeners.delete(method)
        resolve(p)
      },
    ])
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 设备仿真：390×844 / DPR3 / 触屏（hover:none + pointer:coarse 生效）──
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
})
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')

// ── 打开站点 ──
const loaded = once('Page.loadEventFired')
await send('Page.navigate', { url: URL_BASE })
await loaded
await sleep(2600) // 等入场动画与快照渲染稳定

// ── 结构检查（三项修复的计算样式证据）──
const checks = await evalValue(`(() => {
      const cs = (el, pseudo) => el ? getComputedStyle(el, pseudo || null) : null
      const q = (s) => document.querySelector(s)
      return {
        hoverNone: matchMedia('(hover: none)').matches,
        pointerCoarse: matchMedia('(pointer: coarse)').matches,
        badgeLayers: document.querySelectorAll('.badge-layer').length,
        badgeWillChange: cs(q('.badge'))?.willChange ?? 'NO_EL',
        faceBackdrop: cs(q('.badge-face'))?.backdropFilter ?? 'NO_EL',
        blobBeforeAnim: cs(q('.blob'), '::before')?.animationName ?? 'NO_EL',
        blobWillChange: cs(q('.blob'))?.willChange ?? 'NO_EL',
        glassBackdrop: cs(q('.glass'))?.backdropFilter ?? 'NO_EL',
        catSvgPresent: !!q('svg[data-cat]'),
      }
    })()`)

// ── 截图 1：首屏（hero 文字 + 玻璃徽标/按钮）──
async function shot(file) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT_DIR, file), Buffer.from(data, 'base64'))
}
await shot('01-hero-mobile.png')

// ── 截图 2：徽章区域特写 ──
await send('Runtime.evaluate', {
  expression: `document.querySelector('.cat-stage').scrollIntoView({ block: 'center' })`,
})
await sleep(800)
// captureScreenshot 的 clip 相对文档原点（非视口），需加 scrollY
const rect = await evalValue(
  `(() => { const r = document.querySelector('.cat-stage').getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height } })()`,
)
{
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 },
  })
  fs.writeFileSync(path.join(OUT_DIR, '02-badge-mobile.png'), Buffer.from(data, 'base64'))
}

// ── 帧率测量：页面静止（不滚动）+ rAF 帧间隔统计。
//    不滚动、降为 DPR1 是为了让「blob 交叉动画 / backdrop 重采样」成为
//    唯一变量——否则全页软件光栅开销会淹没 A/B 差异。
//    修复前：静止时光斑持续重模糊 + glass 持续重采样 → 持续重绘；
//    修复后：静止时无任何重绘源，帧应完全静止。──
const FPS_EXPR = `new Promise(res => {
  const deltas = []
  let last = performance.now()
  const t0 = last
  ;(function tick() {
    const t = performance.now()
    deltas.push(t - last)
    last = t
    if (t - t0 < 4000) requestAnimationFrame(tick)
    else {
      const dur = (t - t0) / 1000
      const janky = deltas.filter(d => d > 24).length
      res({
        fps: +(deltas.length / dur).toFixed(1),
        jankyPct: +((janky / deltas.length) * 100).toFixed(1),
        avgFrameMs: +(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1),
      })
    }
  })()
})`
async function measureFps(rate) {
  await send('Emulation.setCPUThrottlingRate', { rate })
  const v = await evalValue(FPS_EXPR, true)
  await send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return v
}

// ── 主线程重绘追踪（决定性指标）：Tracing 收集 devtools.timeline，
//    统计 Paint/RasterTask 等任务总耗时。修复前静止时持续重模糊 → 大量
//    Paint/Raster；修复后静止时无重绘源 → 趋零。与合成器快慢无关。──
async function traceWorkload(ms) {
  const events = []
  const listener = (p) => {
    if (Array.isArray(p.value)) events.push(...p.value)
  }
  if (!listeners.has('Tracing.dataCollected'))
    listeners.set('Tracing.dataCollected', [listener])
  await send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline',
    options: 'sampling-frequency=1000',
  })
  await sleep(ms)
  const done = once('Tracing.tracingComplete')
  await send('Tracing.end')
  await done
  listeners.delete('Tracing.dataCollected')
  const sums = {}
  for (const e of events) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue
    if (!/devtools\.timeline/.test(e.cat || '')) continue
    sums[e.name] = (sums[e.name] || 0) + e.dur / 1000 // → ms
  }
  // 只保留与重绘/光栅/合成相关的条目，按耗时降序
  const pick = ['Paint', 'RasterTask', 'ImageDecodeTask', 'CompositeLayers', 'DrawFrame', 'Layout', 'RecalculateStyles', 'UpdateLayerTree', 'PrePaint', 'PaintSetup']
  return Object.fromEntries(
    pick.filter((k) => sums[k]).map((k) => [k, +sums[k].toFixed(0)]),
  )
}

// Tracing 域无需 enable，start 即用
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
})
await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0)` })
await sleep(600)
const fpsAfter = await measureFps(4) // 4x CPU 降速 ≈ 中端手机

// ── A/B：注入样式还原修复前开销，同环境复测 ──
await send('Runtime.evaluate', {
  expression: `(() => {
    const s = document.createElement('style')
    s.id = 'verify-prefix-sim'
    s.textContent = \`@media (hover: none) {
      .blob::before { animation: blob-cross 11s ease-in-out infinite alternate !important; }
      .blob, .blob-par { will-change: transform !important; }
      .glass { backdrop-filter: blur(18px) !important; -webkit-backdrop-filter: blur(18px) !important; background: var(--glass) !important; }
      .badge { will-change: transform !important; }
      .badge-face { backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; }
    }\`
    document.head.appendChild(s)
  })()`,
})
await sleep(600)
const fpsBefore = await measureFps(4)

// ── 主线程重绘 A/B：修复后（静止应无重绘）vs 修复前模拟（持续重模糊）──
await send('Runtime.evaluate', {
  expression: `document.getElementById('verify-prefix-sim')?.remove()`,
})
await sleep(600)
const traceAfter = await traceWorkload(4000)
await send('Runtime.evaluate', {
  expression: `(() => {
    const s = document.createElement('style')
    s.id = 'verify-prefix-sim'
    s.textContent = \`@media (hover: none) {
      .blob::before { animation: blob-cross 11s ease-in-out infinite alternate !important; }
      .glass { backdrop-filter: blur(18px) !important; -webkit-backdrop-filter: blur(18px) !important; background: var(--glass) !important; }
    }\`
    document.head.appendChild(s)
  })()`,
})
await sleep(600)
const traceBefore = await traceWorkload(4000)

// ── 诊断场景 C：光斑完全静止（路径动画也冻结）。
//    若帧耗骤降，证明残余帧耗 = 软件合成器逐帧绘制漂移模糊纹理的成本
//    （软件渲染特有；真机 GPU 上该成本近乎为零）──
await send('Runtime.evaluate', {
  expression: `(() => {
    const s = document.createElement('style')
    s.id = 'verify-frozen'
    s.textContent = '@media (hover: none) { .blob { animation: none !important; } .blob::before { animation: none !important; } }'
    document.head.appendChild(s)
  })()`,
})
await sleep(600)
const fpsFrozen = await measureFps(4)

// ── 汇总 ──
const report = {
  env: { browser: path.basename(browser), viewport: '390x844@3x-touch', rendering: 'software (弱GPU模拟)' },
  checks,
  frameStats: { 'CPU4x_修复后': fpsAfter, 'CPU4x_还原修复前': fpsBefore, 'CPU4x_光斑全静止诊断': fpsFrozen },
  paintMs4s: { '修复后_静止': traceAfter, '还原修复前_静止': traceBefore },
  consoleErrors: consoleErrors.slice(0, 10),
  screenshots: OUT_DIR,
}
console.log(JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))

ws.close()
proc.kill()
// Chrome 退出有延迟，立即删目录会 EBUSY；失败不阻塞报告输出
setTimeout(() => {
  try {
    fs.rmSync(profileDir, { recursive: true, force: true })
  } catch { /* 临时目录留给系统清理 */ }
}, 1500)
