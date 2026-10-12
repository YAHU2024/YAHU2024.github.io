// PNG 像素采样：node scripts/px-probe.mjs <file.png> x,y [x,y ...]
// 仅支持 Chrome 导出的 8-bit RGBA PNG（非交错）。用于徽章对比的精确定量。
import fs from 'node:fs'
import zlib from 'node:zlib'

const [, , file, ...points] = process.argv
const buf = fs.readFileSync(file)

// ── PNG 解析 ──
let pos = 8
let width = 0, height = 0, bitDepth = 0, colorType = 0
const idat = []
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos)
  const type = buf.toString('ascii', pos + 4, pos + 8)
  const data = buf.subarray(pos + 8, pos + 8 + len)
  if (type === 'IHDR') {
    width = data.readUInt32BE(0)
    height = data.readUInt32BE(4)
    bitDepth = data[8]
    colorType = data[9]
  } else if (type === 'IDAT') idat.push(data)
  else if (type === 'IEND') break
  pos += 12 + len
}
if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
  console.error(`不支持: bitDepth=${bitDepth} colorType=${colorType}（需要 8-bit RGB/RGBA）`)
  process.exit(1)
}
const bpp = colorType === 6 ? 4 : 3
const raw = zlib.inflateSync(Buffer.concat(idat))
const stride = width * bpp
const img = Buffer.alloc(height * stride)
// 反滤波
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
// ── 采样输出 ──
console.log(`${file}: ${width}x${height}`)
for (const pt of points) {
  if (pt.startsWith('line:')) {
    const yp = Number(pt.slice(5)) // 行位置（高度百分比）
    const y = Math.round((height - 1) * (yp / 100))
    const step = Math.max(1, Math.round(width / 60))
    const parts = []
    for (let x = 0; x < width; x += step) {
      const o = (y * width + x) * bpp
      parts.push(`${x}:${img[o]},${img[o + 1]},${img[o + 2]}`
      )
    }
    console.log(`line y=${y} (x:rgb): ` + parts.join('  '))
    continue
  }
  const [xs, ys] = pt.split(',').map(Number)
  const o = (ys * width + xs) * bpp
  const [r, g, b] = [img[o], img[o + 1], img[o + 2]]
  const a = bpp === 4 ? img[o + 3] : 255
  console.log(
    `@(${xs},${ys}) rgb(${r},${g},${b}) a=${(a / 255).toFixed(3)}` +
      (a < 255 ? ` → 白底合成: ` + compositOver([r, g, b], a / 255, [255, 255, 255]) : ''),
  )
}
function compositOver(c, a, bg) {
  return `rgb(${c.map((v, i) => Math.round(v * a + bg[i] * (1 - a))).join(',')})`
}
