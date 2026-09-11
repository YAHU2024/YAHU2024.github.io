// ─────────────────────────────────────────────────────────────
// 轻量富文本解析：把 **粗体** / *强调* 标记转成 token 数组
// 设计取舍：copy.ts 只存纯字符串（改文案只改一行），渲染端按需解析；
//          不引入 markdown 依赖，避免为了两处强调拖进完整解析器。
// 规则：
//   **文字** → kind: 'strong'（前景色加粗）
//   *文字*   → kind: 'accent'（accent 色加粗）
//   未闭合 / 无匹配 → 原样当普通文本输出，不会吞字
// ─────────────────────────────────────────────────────────────

export type RichToken = {
  text: string
  kind?: 'strong' | 'accent'
}

const RICH_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*/g

export function parseRichText(input: string): RichToken[] {
  const tokens: RichToken[] = []
  let last = 0
  let match: RegExpExecArray | null

  RICH_RE.lastIndex = 0
  while ((match = RICH_RE.exec(input)) !== null) {
    const start = match.index
    if (start > last) tokens.push({ text: input.slice(last, start) })

    if (match[1] !== undefined) tokens.push({ text: match[1], kind: 'strong' })
    else if (match[2] !== undefined) tokens.push({ text: match[2], kind: 'accent' })
    else tokens.push({ text: match[0] })

    last = start + match[0].length
  }

  if (last < input.length) tokens.push({ text: input.slice(last) })
  return tokens
}
