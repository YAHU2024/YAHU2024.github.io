// ─────────────────────────────────────────────────────────────
// 「最近」页内容源（顶栏「最近」→ #recent 视图）
//
// 结构对应 sandev.cc/zh/notes 的两层内容：
//   1. 动态（timeline）—— 日期 + 一段话（双语 L），渲染成玻璃卡日期流
//   2. 计划（plans）—— 编号 + 代号 + 标题 + 描述 + 进度 + 状态标签
//
// 改内容只动这个文件（面向用户展示的文案字段为双语 L：zh/en 必须同时写）；
// 界面文案在 src/data/copy.ts 的 recentPage 段
// ─────────────────────────────────────────────────────────────

import type { L } from '@/hooks/useLocale'

export interface NowEntry {
  emoji: string
  text: L
}

export interface TimelineEntry {
  /** ISO 日期，如 '2026-09-04' */
  date: string
  text: L
}

export interface PlanEntry {
  /** 代号小标（专有名词，不翻译），如 'UNARCHIVE' */
  tag: string
  title: L
  desc?: L
  /** 进度 0-100，不填则不渲染进度条 */
  progress?: number
  /** 状态标签文字：持续 / 开发中 / 想做 */
  status: L
}

export const now = {
  /** 最后更新时间 */
  updatedAt: '2026-09-08',
  /** 最近动态（新→旧），「最近」页日期流数据源 */
  timeline: [
    {
      date: '2026-09-09',
      text: {
        zh: '作品站新增「最近」页：动态日期流 + 计划清单，猫徽章转场整圈翻转',
        en: 'Portfolio site: new Recent page with updates feed and plans list; full-spin cat badge transition',
      },
    },
    {
      date: '2026-09-04',
      text: {
        zh: '作品站字体改为自托管，补上社交分享图',
        en: 'Portfolio site: fonts switched to self-hosting, plus a new social share image',
      },
    },
    {
      date: '2026-08-20',
      text: { zh: 'QuickTranslate 发布 v1.9.2', en: 'QuickTranslate v1.9.2 released' },
    },
  ] satisfies TimelineEntry[],
  /**
   * 计划清单（新→旧按优先级排），「最近」页编号计划卡数据源
   * 进度 / 状态语义与 projects.ts 对齐：progress 仅进行中有意义
   */
  plans: [
    {
      tag: 'YAHU.GITHUB.IO',
      title: { zh: '把作品站补完整', en: 'Complete the portfolio site' },
      desc: {
        zh: '继续补充真实项目资料、可用入口与展示状态。',
        en: 'Keep adding real project details, working links, and showcase status.',
      },
      status: { zh: '持续', en: 'Ongoing' },
    },
    {
      tag: 'UNARCHIVE',
      title: { zh: '推进UI界面重构', en: 'Drive the UI redesign' },
      desc: {
        zh: 'UI调研、动效打磨、交互体验优化，逐步替换旧版界面。',
        en: 'UI research, motion polish, and interaction improvements — replacing the old UI step by step.',
      },
      progress: 40,
      status: { zh: '开发中', en: 'WIP' },
    },
    {
      tag: 'QUICKTRANSLATE',
      title: { zh: '截图翻译开发', en: 'Screenshot translation' },
      desc: {
        zh: '生产级OCR截图翻译，复杂背景/漫画识别，自动路由',
        en: 'Production-grade OCR screenshot translation — complex backgrounds, manga, auto routing',
      },
      progress: 60,
      status: { zh: '开发中', en: 'WIP' },
    },
  ] satisfies PlanEntry[],
}
