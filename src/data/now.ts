// ─────────────────────────────────────────────────────────────
// 「最近状态」内容源
//
// 当前页面上只有两处会用到这里：
//   1. bubbleLines —— 猫徽章右上角气泡的两行正文（改文案改这个）
//   2. 其余字段（doing / learning / timeline / updatedAt）暂未引用，
//      保留作数据留存，恢复「最近状态」区块时直接可用
//
// 界面文案（状态胶囊等）在 src/data/copy.ts 的 catBubble 段
// ─────────────────────────────────────────────────────────────

export interface NowEntry {
  emoji: string
  text: string
}

export interface TimelineEntry {
  /** ISO 日期，如 '2026-09-04' */
  date: string
  text: string
}

export const now = {
  /** 最后更新时间（气泡不再展示，保留给将来其他用途） */
  updatedAt: '2026-09-05',
  /**
   * 「最近」标签后面那一行 —— **改这里就能改，不用动组件**
   * 位置：Hero 左半屏，tagline 下方，紧跟在 accent 色「最近」小标签同一行
   * 单行，建议 ≤ 40 个中文字符，太长会在标签下方折行
   */
  recent: '在重构 Unarchive UI',
  /**
   * 正在做的事 —— **当前页面未引用，仅作数据留存**
   * （气泡正文走 bubbleLines，状态胶囊已去掉计数）
   * 若日后要恢复完整的「最近状态」区块，这里就是数据源
   */
  doing: [
    { emoji: '🎨', text: '雅刷刷题页的 UI 重构，逐个打磨 cube-wave 系列动效' },
    { emoji: '🎙️', text: 'Unarchive 的 ASR 链路：本地 sherpa-onnx 与云端 SiliconFlow 二选一' },
  ] satisfies NowEntry[],
  /** 在学 / 在读 */
  learning: [
    { emoji: '🧩', text: 'HarmonyOS ArkTS 与 Hypium UI 自动化测试' },
    { emoji: '🍃', text: '茶叶叶片年龄识别：多特征融合 + 轻量级 SVM' },
  ] satisfies NowEntry[],
  /** 最近动态（新→旧） */
  timeline: [
    { date: '2026-09-04', text: '作品站字体改为自托管，补上社交分享图' },
    { date: '2026-08-20', text: 'QuickTranslate 发布 v1.9.2（占位日期，待核对）' },
    { date: '2026-08-10', text: '雅刷完成更名，题库导入支持 Word / Excel / TXT（占位日期，待核对）' },
  ] satisfies TimelineEntry[],
}
