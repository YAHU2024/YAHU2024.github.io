// ─────────────────────────────────────────────────────────────
// 「最近」页内容源（顶栏「最近」→ #recent 视图）
//
// 结构对应 sandev.cc/zh/notes 的两层内容：
//   1. 动态（timeline）—— 日期 + 一段话，渲染成玻璃卡日期流
//   2. 计划（plans）—— 编号 + 代号 + 标题 + 描述 + 进度 + 状态标签
//
// 改内容只动这个文件；界面文案在 src/data/copy.ts 的 recentPage 段
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

export interface PlanEntry {
  /** 代号小标，如 'UNARCHIVE' */
  tag: string
  title: string
  desc?: string
  /** 进度 0-100，不填则不渲染进度条 */
  progress?: number
  /** 状态标签文字：持续 / 开发中 / 想做 */
  status: string
}

export const now = {
  /** 最后更新时间 */
  updatedAt: '2026-09-08',
  /** 最近动态（新→旧），「最近」页日期流数据源 */
  timeline: [
    { date: '2026-09-09', text: '作品站新增「最近」页：动态日期流 + 计划清单，猫徽章转场整圈翻转' },
    { date: '2026-09-04', text: '作品站字体改为自托管，补上社交分享图' },
    { date: '2026-08-20', text: 'QuickTranslate 发布 v1.9.2' },
  ] satisfies TimelineEntry[],
  /**
   * 计划清单（新→旧按优先级排），「最近」页编号计划卡数据源
   * 进度 / 状态语义与 projects.ts 对齐：progress 仅进行中有意义
   */
  plans: [
    {
      tag: 'YAHU.GITHUB.IO',
      title: '把作品站补完整',
      desc: '继续补充真实项目资料、可用入口与展示状态。',
      status: '持续',
    },
    {
      tag: 'UNARCHIVE',
      title: '推进UI界面重构',
      desc: 'UI调研、动效打磨、交互体验优化，逐步替换旧版界面。',
      progress: 40,
      status: '开发中',
    },
    {
      tag: '（想法位）',
      title: '下一个值得动手的想法',
      desc: '想清楚之后再补名称和仓库。',
      status: '想做',
    },
  ] satisfies PlanEntry[],
}
