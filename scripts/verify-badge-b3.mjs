// B3 兜底验证：① 禁 WebGL → Badge2DFallback 出现且可拖拽；② context lost/restore → 渲染恢复不降级
// 用法：node scripts/verify-badge-b3.mjs [url]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const URL_BASE = process.argv[2] || 'http://localhost:4175/'
const OUT_DIR = path.resolve('docs/b3-shots')
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

const results = []
const check = (name, ok, evidence) => results.push({ name, ok, evidence })

// ── 场景 1：禁 WebGL（覆写 getContext，webgl/experimental-webgl 一律返回 null）──
{
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-b3a-'))
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
    if (r.exceptionDetails) throw new Error('页面脚本异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result?.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(s.data, 'base64'))
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false })
  // 文档加载前注入：WebGL 永久不可用
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `HTMLCanvasElement.prototype.getContext = function (type) {
      if (/webgl/i.test(String(type))) return null
      return HTMLCanvasElement.prototype.__origGetContext.apply(this, arguments)
    }
    HTMLCanvasElement.prototype.__origGetContext = HTMLCanvasElement.prototype.getContext`,
  })
  const done = new Promise((r) => listeners.set('Page.loadEventFired', [r]))
  await send('Page.navigate', { url: URL_BASE })
  await done
  await sleep(3000)

  const s1 = await evalValue(`({
    fallback: !!document.querySelector('.badge2d'),
    canvas3d: !!document.querySelector('.badge-canvas'),
  })`)
  await shot('fallback-2d.png')
  check('禁 WebGL → 2D 兜底出现', s1.fallback && !s1.canvas3d, `badge2d=${s1.fallback} badge-canvas=${s1.canvas3d}`)

  // 2D 徽章可拖拽：pointer 拖 300px（>半宽即翻面），读 transform rotateY
  const box = await evalValue(`(() => {
    const r = document.querySelector('.badge2d').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
  for (let i = 1; i <= 8; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + (300 * i) / 8, y: box.y, button: 'left' })
    await sleep(16)
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + 300, y: box.y, button: 'left', clickCount: 1 })
  await sleep(400)
  const dragTf = await evalValue(`document.querySelector('.badge2d [style*=rotate]')?.style.transform || document.querySelector('.badge2d')?.innerHTML.slice(0, 80)`)
  await shot('fallback-drag.png')
  check('2D 兜底可拖拽翻转', typeof dragTf === 'string' && dragTf.includes('rotateY'), `transform="${String(dragTf).slice(0, 60)}"`)
  proc.kill()
}

// ── 场景 2：context lost → restore，渲染恢复且不切 2D ──
{
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-b3b-'))
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
    if (r.exceptionDetails) throw new Error('页面脚本异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result?.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(s.data, 'base64'))
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false })
  const done = new Promise((r) => listeners.set('Page.loadEventFired', [r]))
  await send('Page.navigate', { url: URL_BASE })
  await done
  await sleep(3000)

  const before = await evalValue(`({ canvas: !!document.querySelector('.badge-canvas'), fb: !!document.querySelector('.badge2d') })`)
  // 强制 context lost（提前保存 extension 引用：lost 后 getContext 返回 null）
  await evalValue(`(() => {
    const c = document.querySelector('.badge-canvas')
    const gl = c.getContext('webgl')
    const ext = gl.getExtension('WEBGL_lose_context')
    window.__loseExt = ext
    ext.loseContext()
    return true
  })()`)
  await sleep(300)
  const lostState = await evalValue(`({ canvas: !!document.querySelector('.badge-canvas'), fb: !!document.querySelector('.badge2d') })`)
  // restore（用丢失前保存的引用）
  await evalValue(`window.__loseExt.restoreContext()`)
  await sleep(800)
  const restored = await evalValue(`({
    canvas: !!document.querySelector('.badge-canvas'),
    fb: !!document.querySelector('.badge2d'),
    w: document.querySelector('.badge-canvas')?.width || 0,
  })`)
  await shot('context-restored.png')
  check(
    'context lost 期间保持 3D 分支（不误切 2D）',
    before.canvas && lostState.canvas && !lostState.fb,
    `lost 后 canvas=${lostState.canvas} fallback=${lostState.fb}`,
  )
  check(
    'context restored 后渲染恢复（画布尺寸重建）',
    restored.canvas && !restored.fb && restored.w > 0,
    `canvas=${restored.canvas} width=${restored.w}px，context-restored.png 已产出`,
  )
  proc.kill()
}

console.log('\n════ B3 兜底验证 ════')
let fail = 0
for (const r of results) {
  if (!r.ok) fail++
  console.log(`${r.ok ? '✅' : '❌'} ${r.name} — ${r.evidence}`)
}
console.log(`\n${results.length - fail}/${results.length} 通过；截图在 ${OUT_DIR}`)
process.exit(fail ? 1 : 0)
