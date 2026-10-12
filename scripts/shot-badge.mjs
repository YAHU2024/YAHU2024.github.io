// 徽章特写截图：node scripts/shot-badge.mjs <url> <outfile> [theme] [selector]
// 用途：B1 验收——新旧徽章并排逐项对比（侧壁色带/倒角/投影/高光/直径）。
// 依赖本机 Chrome/Edge（headless CDP），无 puppeteer 依赖。
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const [, , URL_BASE = 'http://localhost:5173', OUT_FILE = 'badge.png', THEME = '', SELECTOR = '.cat-stage'] =
  process.argv
const browser = process.env.BROWSER
  ? [process.env.BROWSER].find((p) => fs.existsSync(p))
  : [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].find((p) => fs.existsSync(p))
if (!browser) {
  console.error('未找到 Chrome / Edge')
  process.exit(1)
}
fs.mkdirSync(path.dirname(path.resolve(OUT_FILE)), { recursive: true })

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-shot-'))
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
  setTimeout(() => rej(new Error('Chrome 启动超时')), 30000)
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.exceptionDetails)
    throw new Error('页面脚本异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  return r.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 2,
  mobile: false,
})
// 主题预设：加载前写入 localStorage（空 THEME = 跟随默认）
if (THEME) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('theme', '${THEME}') } catch (e) {}`,
  })
}
const done = new Promise((r) => listeners.set('Page.loadEventFired', [r]))
await send('Page.navigate', { url: URL_BASE })
await done
listeners.delete('Page.loadEventFired')
await sleep(3000)

await evalValue(`document.querySelector('${SELECTOR}')?.scrollIntoView({ block: 'center' })`)
await sleep(1000)
const rect = await evalValue(
  `(() => { const r = document.querySelector('${SELECTOR}').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()`,
)
const s = await send('Page.captureScreenshot', {
  format: 'png',
  clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 2 },
})
fs.writeFileSync(OUT_FILE, Buffer.from(s.data, 'base64'))
console.log('saved:', path.resolve(OUT_FILE))
proc.kill()
process.exit(0)
