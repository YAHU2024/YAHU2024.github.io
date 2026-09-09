// ─────────────────────────────────────────────────────────────
// 项目主数据（按状态分组展示）
// 替代原来的 featured（精选三卡）+ allRepos（自动拉取的仓库列表）
//
// 想改项目内容：只改这个文件
// 想改界面文案（标题 / 状态标签 / 按钮）：改 src/data/copy.ts 的 projects 段
//
// 状态三档语义（不要混用）：
//   doing   —— 正在做，有明确进度；填 progress 会渲染进度条
//   shipped —— 已上线，能用；填 links 给出入口
//   idea    —— 只是想法，没有仓库也不承诺时间；一句话说清即可
// ─────────────────────────────────────────────────────────────

export type ProjectStatus = 'doing' | 'shipped' | 'idea'

export interface ProjectItem {
  name: string
  emoji: string
  status: ProjectStatus
  /** 一句话说明：讲清「它是什么 / 现在到哪一步」 */
  oneLine: string
  /** 进度 0-100，仅 doing 有意义；不填则不渲染进度条 */
  progress?: number
  /** 落地平台，如 ['Windows'] ['小程序', 'App'] */
  platform?: string[]
  /** 补充信息，如「当前版本 v1.9.2」「暂无下载入口」 */
  note?: string
  tags?: string[]
  /** 外链：repo = 源码，site = 官网 / 下载页 */
  links?: { repo?: string; site?: string }
}

export const projects: ProjectItem[] = [
  {
    name: 'Unarchive',
    emoji: '🎙️',
    status: 'doing',
    oneLine: 'UI重构进行中，B站视频转笔记流程已打通',
    progress: 40,
    platform: ['Android'],
    tags: ['sherpa-onnx', 'SenseVoice', 'SiliconFlow'],
    note: '本地 ASR（SenseVoice）与云端（SiliconFlow）暂只启用其一',
  },
  {
    name: 'QuickTranslate',
    emoji: '⚡',
    status: 'shipped',
    oneLine: '划词翻译桌面工具，SSE 流式输出 + SQLite 历史 + 自动更新',
    platform: ['Windows'],
    tags: ['WPF', '.NET 8'],
    links: { site: 'https://yahu2024.github.io/myTool/', repo: 'https://github.com/YAHU2024/myTool' },
    note: '当前版本 v1.9.2',
  },
  {
    name: '（想法位）',
    emoji: '💡',
    status: 'idea',
    oneLine: '这个位置留给下一个值得动手的想法',
    note: '想清楚之后再补名称和仓库',
  },
]

/** 各状态的展示顺序，组件按此顺序分段渲染 */
export const statusOrder: ProjectStatus[] = ['doing', 'shipped', 'idea']
