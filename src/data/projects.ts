// ─────────────────────────────────────────────────────────────
// 项目主数据（按状态分组展示）
// 替代原来的 featured（精选三卡）+ allRepos（自动拉取的仓库列表）
//
// 想改项目内容：只改这个文件（面向用户展示的文案字段为双语 L：zh/en 必须同时写）
// 想改界面文案（标题 / 状态标签 / 按钮）：改 src/data/copy.ts 的 projects 段
//
// 状态三档语义（不要混用）：
//   doing   —— 正在做，有明确进度；填 progress 会渲染进度条
//   shipped —— 已上线，能用；填 links 给出入口
//   idea    —— 只是想法，没有仓库也不承诺时间；一句话说清即可
// ─────────────────────────────────────────────────────────────

import type { L } from '@/hooks/useLocale'

export type ProjectStatus = 'doing' | 'shipped' | 'idea'

export interface ProjectItem {
  name: L
  emoji: string
  status: ProjectStatus
  /** 一句话说明：讲清「它是什么 / 现在到哪一步」 */
  oneLine: L
  /** 进度 0-100，仅 doing 有意义；不填则不渲染进度条 */
  progress?: number
  /** 落地平台，如 ['Windows'] ['小程序', 'App']（专有名词，不翻译） */
  platform?: string[]
  /** 补充信息，如「当前版本 v1.9.2」「暂无下载入口」 */
  note?: L
  /** 技术标签（专有名词，不翻译） */
  tags?: string[]
  /** 外链：repo = 源码，site = 官网 / 下载页 */
  links?: { repo?: string; site?: string }
}

export const projects: ProjectItem[] = [
  {
    name: { zh: 'Unarchive', en: 'Unarchive' },
    emoji: '🎙️',
    status: 'doing',
    oneLine: {
      zh: 'UI重构进行中，B站视频转笔记流程已打通',
      en: 'UI redesign in progress — the Bilibili video-to-notes pipeline is working end to end',
    },
    progress: 40,
    platform: ['Android'],
    tags: ['sherpa-onnx', 'SenseVoice', 'SiliconFlow'],
    note: {
      zh: '本地 ASR（SenseVoice）与云端（SiliconFlow）暂只启用其一',
      en: 'Local ASR (SenseVoice) and cloud (SiliconFlow) — only one enabled for now',
    },
  },
  {
    name: { zh: 'QuickTranslate', en: 'QuickTranslate' },
    emoji: '⚡',
    status: 'shipped',
    oneLine: {
      zh: '划词翻译桌面工具，SSE 流式输出 + SQLite 历史 + 自动更新',
      en: 'Selection-translate desktop app — SSE streaming, SQLite history, and auto-update',
    },
    platform: ['Windows'],
    tags: ['WPF', '.NET 8'],
    links: { site: 'https://yahu2024.github.io/myTool/', repo: 'https://github.com/YAHU2024/myTool' },
    note: { zh: '当前版本 v1.9.2', en: 'Current version v1.9.2' },
  },
  {
    name: { zh: '（想法位）', en: 'Placeholder' },
    emoji: '💡',
    status: 'idea',
    oneLine: {
      zh: '这个位置留给下一个值得动手的想法',
      en: 'Reserved for the next idea worth building',
    },
    note: {
      zh: '想清楚之后再补名称和仓库',
      en: 'Name and repo to be added once the idea takes shape',
    },
  },
]

/** 各状态的展示顺序，组件按此顺序分段渲染 */
export const statusOrder: ProjectStatus[] = ['doing', 'shipped', 'idea']
