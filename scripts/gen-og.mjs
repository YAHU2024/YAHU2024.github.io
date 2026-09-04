// 生成社交分享卡片 public/og-image.png（1200×630）
//
// 用本机 Chrome / Edge 无头渲染 scripts/og-template.html：
// 字体以 base64 内联，因此离线可渲染，且与站点共用同一套 Archivo 字重。
//
//   node scripts/gen-og.mjs
//
// 改文案：编辑 scripts/og-template.html 后重跑本脚本。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fontPath = path.join(root, 'public/fonts/archivo-latin-var.woff2')
const tplPath = path.join(root, 'scripts/og-template.html')
const outPath = path.join(root, 'public/og-image.png')

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

if (!fs.existsSync(fontPath)) {
  console.error('缺少字体文件：', fontPath)
  process.exit(1)
}

const browser = BROWSERS.find((p) => fs.existsSync(p))
if (!browser) {
  console.error('未找到 Chrome / Edge，无法渲染分享图。')
  process.exit(1)
}

const b64 = fs.readFileSync(fontPath).toString('base64')
const html = fs.readFileSync(tplPath, 'utf8').replace('__FONT_B64__', b64)
const tmp = path.join(os.tmpdir(), 'og-render.html')
fs.writeFileSync(tmp, html, 'utf8')

execFileSync(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    `--screenshot=${outPath}`,
    `file:///${tmp.replace(/\\/g, '/')}`,
  ],
  { stdio: 'ignore' },
)

fs.rmSync(tmp, { force: true })
console.log(`已生成 ${path.relative(root, outPath)}（${(fs.statSync(outPath).size / 1024).toFixed(1)} KB）`)
