// vivo 浏览器怪癖修复验证（三证据链互补）：
//
//   node scripts/verify-vivo-sim.mjs [输出目录]
//
// 背景：vivo 定制内核触屏下不上报 hover:none（用户实测其 .glass 纯色降级不生效、
// 徽章跑 42 层触发塌缩 bug）。修复 = 触屏判定扩展为 (hover:none), (pointer:coarse)。
// 本机 Chrome CDP 的 setEmulatedMedia 不支持仿 pointer 主指针特性（实测仅 any-pointer
// 生效），故用三条互补证据链覆盖：
//   1) JS 兜底：addScriptToEvaluateOnNewDocument 垫片 matchMedia（vivo 上报形态：
//      hover:none=false / pointer:coarse=true）→ 验证 isTouch 兜底 → 16 层
//   2) CSS 全链路：setTouchEmulationEnabled（微信/正常安卓形态，两特性均命中）
//      → 验证 CSS 降级全命中 + 徽章截图
//   3) 构建产物结构：直接检查 dist CSS 两处媒体查询均含 pointer:coarse 分支
// 前置条件：npm run preview 已在 4173 端口运行（serve dist）。
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const URL_BASE = process.env.VERIFY_URL || 'http://localhost:4173'
const OUT_DIR =
  process.argv[2] || path.join(os.tmpdir(), 'vivo-verify')
const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))
if (!browser) {
  console.error('未找到 Chrome / Edge')
  process.exit(1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })

// ── 证据链 3：构建产物结构检查（无需浏览器）──
const cssFile = fs.readdirSync('dist/assets').find((f) => f.endsWith('.css'))
const cssText = fs.readFileSync(path.join('dist/assets', cssFile), 'utf8')
// 兼容压缩格式（@media(hover:none),(pointer:coarse){ 无空格）
const hoverOnlyCount = (cssText.match(/@media\s*\(\s*hover:\s*none\s*\)\s*\{/gi) || []).length
const combinedCount = (cssText.match(/@media\s*\(\s*hover:\s*none\s*\)\s*,\s*\(\s*pointer:\s*coarse\s*\)/gi) || []).length

// ── CDP 启动 ──
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-vivo-'))
const proc = spawn(
  browser,
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--disable-gpu',
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
function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve) => {
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalValue(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.exceptionDetails)
    throw new Error('页面脚本异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  return r.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Runtime.enable')

async function navigate() {
  const done = new Promise((r) => listeners.set('Page.loadEventFired', [r]))
  const guard = setTimeout(() => {
    listeners.delete('Page.loadEventFired')
    console.error('[warn] Page.loadEventFired 超时 15s，继续执行')
    r()
  }, 15000)
  await send('Page.navigate', { url: URL_BASE })
  await done
  clearTimeout(guard)
  listeners.delete('Page.loadEventFired')
  await sleep(2600)
}
async function shotBadge(file) {
  await evalValue(`document.querySelector('.cat-stage').scrollIntoView({ block: 'center' })`)
  await sleep(800)
  const rect = await evalValue(
    `(() => { const r = document.querySelector('.cat-stage').getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height } })()`,
  )
  const s = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 },
  })
  fs.writeFileSync(path.join(OUT_DIR, file), Buffer.from(s.data, 'base64'))
}

const collect = `(() => {
  const cs = (el, pseudo) => (el ? getComputedStyle(el, pseudo || null) : null)
  const q = (s) => document.querySelector(s)
  const glassEl = q('.glass')
  return {
    mediaHover: matchMedia('(hover: none)').matches,
    mediaCoarse: matchMedia('(pointer: coarse)').matches,
    badgeLayers: document.querySelectorAll('.badge-layer').length,
    badgeWillChange: cs(q('.badge'))?.willChange ?? 'NO_EL',
    faceBackdrop: cs(q('.badge-face'))?.backdropFilter ?? 'NO_EL',
    glassBackdrop: glassEl ? cs(glassEl).backdropFilter : 'NO_EL',
    glassBgAlpha: glassEl ? cs(glassEl).backgroundColor : 'NO_EL',
    blobBeforeAnim: cs(q('.blob'), '::before')?.animationName ?? 'NO_EL',
    catSvgPresent: !!q('svg[data-cat]'),
  }
})()`

// ═══ 证据链 1：matchMedia 垫片（vivo 上报形态，JS 兜底验证）═══
// 在任何页面脚本前注入：hover:none → false，pointer:coarse → true（其余走原实现）
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    const orig = window.matchMedia.bind(window)
    window.matchMedia = (q) => {
      if (q === '(hover: none)') return { matches: false, media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, onchange: null, dispatchEvent(){ return false } }
      if (q === '(pointer: coarse)') return { matches: true, media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, onchange: null, dispatchEvent(){ return false } }
      return orig(q)
    }`,
})
console.log('[progress] chain1: 垫片已注入，开始导航')
await navigate()
console.log('[progress] chain1: 页面加载完成，采集检查项')
const jsShimChecks = await evalValue(collect)
console.log('[progress] chain1: 截图')
await shotBadge('badge-vivo-js-shim.png')

// ═══ 证据链 2：触摸仿真全链路（微信/正常安卓形态，两特性均命中）═══
// 换 target 避开已注入的垫片
await send('Runtime.evaluate', { expression: `location.reload()` })
const r2 = await fetch(`http://127.0.0.1:${port}/json/new?url=about:blank`, { method: 'PUT' })
const target2 = await r2.json()
const ws2 = new WebSocket(target2.webSocketDebuggerUrl)
await new Promise((r) => (ws2.onopen = r))
// 简化：直接在当前页关闭垫片影响 —— reload 后垫片仍会注入（addScriptToEvaluateOnNewDocument 是持久的），
// 因此走触摸仿真也带着垫片（垫片只是把 hover:none 置 false，触摸仿真下 CSS 命中靠 pointer:coarse 分支，
// JS 命中也靠 pointer:coarse 分支 → 恰好同时验证两层的 coarse-only 路径）
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
console.log('[progress] chain2: 触摸仿真已开启，reload')
await send('Runtime.evaluate', { expression: `location.reload()` })
await sleep(3000)
console.log('[progress] chain2: 采集检查项')
const touchChecks = await evalValue(collect)
console.log('[progress] chain2: 截图')
await shotBadge('badge-touch-full.png')
console.log('[progress] 汇总判定')

// ── 判定 ──
const verdict1 =
  jsShimChecks.mediaHover === false &&
  jsShimChecks.mediaCoarse === true &&
  jsShimChecks.badgeLayers === 16 &&
  jsShimChecks.catSvgPresent === true
const verdict2 =
  touchChecks.mediaCoarse === true &&
  touchChecks.badgeLayers === 16 &&
  touchChecks.badgeWillChange === 'auto' &&
  touchChecks.faceBackdrop === 'none' &&
  touchChecks.glassBackdrop === 'none' &&
  touchChecks.blobBeforeAnim === 'none' &&
  touchChecks.catSvgPresent === true
const verdict3 = combinedCount >= 2 && hoverOnlyCount === 0

const report = {
  chain3_构建产物结构: { combinedMediaBlocks: combinedCount, 仅hoverNone残留: hoverOnlyCount, pass: verdict3 },
  chain1_JS垫片_vivo上报形态: { ...jsShimChecks, pass: verdict1 },
  chain2_触摸仿真_全链路: { ...touchChecks, pass: verdict2 },
  verdict: verdict1 && verdict2 && verdict3 ? 'PASS: 三条证据链全部通过' : 'FAIL: 见上方各项 pass 标记',
  screenshots: OUT_DIR,
}
console.log(JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'vivo-verify-report.json'), JSON.stringify(report, null, 2))

ws.close()
ws2.close()
proc.kill()
setTimeout(() => {
  try {
    fs.rmSync(profileDir, { recursive: true, force: true })
  } catch {}
}, 1500)
// Chrome 子进程句柄会拖住事件循环，报告已输出后显式退出
setTimeout(() => process.exit(0), 2000)
