// ─────────────────────────────────────────────────────────────
// GitHub 数据层
// 1. SNAPSHOT：通过 gh CLI 抓取的离线快照（2026-08-14），作为首屏与兜底数据
// 2. 运行时：useGitHub hook 会调用 GitHub 公开 API 实时刷新
// 3. 想改文案（tagline / headline 等）直接改下面的 profile 即可
// ─────────────────────────────────────────────────────────────

export interface Repo {
  name: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  url: string
  updatedAt: string | null
  topics: string[]
}

export const profile = {
  login: 'YAHU2024',
  name: 'YAHU_bumahu',
  avatarUrl: 'https://avatars.githubusercontent.com/u/185674810?v=4',
  htmlUrl: 'https://github.com/YAHU2024',
  followers: 2,
  following: 3,
  publicRepos: 14,
  createdAt: '2024-10-20',
  contributionsLastYear: 358,
  // ↓ 可编辑的展示文案
  headline: ['BUILD', 'TOOLS.', 'SHIP', 'IDEAS.'],
  tagline: '构建 AI 时代的个人工具 —— 桌面应用、知识流水线与 Agent 技能。',
  subtitle: 'Vibe coding 实践者 · 喜欢把日常需求打磨成顺手的软件',
}

/** 置顶仓库（GitHub REST 不暴露 pinned，用快照里的 GraphQL 结果） */
export const pinnedNames = ['myTool', 'Unarchive', 'claude-skills']

export const languageColors: Record<string, string> = {
  'C#': '#178600',
  Python: '#3572A5',
  Vue: '#41b883',
  Shell: '#89e051',
  Java: '#b07219',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
}

/** gh CLI 快照（2026-08-14），API 不可用时的兜底 */
export const snapshotRepos: Repo[] = [
  {
    name: 'myTool',
    description:
      'AI 时代的学习工具：实时渲染流式输出、智能内容识别、多模式深度解析与追问轻对话、本地历史与隐私安全。',
    language: 'C#',
    stars: 1,
    forks: 0,
    url: 'https://github.com/YAHU2024/myTool',
    updatedAt: '2026-08-14',
    topics: ['ai-tools', 'csharp', 'desktop-app', 'dotnet', 'openai', 'wpf'],
  },
  {
    name: 'Unarchive',
    description: 'Turn Video Favorites into a Personal Knowledge Base',
    language: 'Python',
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/Unarchive',
    updatedAt: '2026-08-14',
    topics: [],
  },
  {
    name: 'claude-skills',
    description: '这是一个skill合集。',
    language: 'Shell',
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/claude-skills',
    updatedAt: '2026-07-21',
    topics: [],
  },
  {
    name: 'YaShua',
    description: null,
    language: 'Vue',
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/YaShua',
    updatedAt: '2026-07-03',
    topics: [],
  },
  {
    name: 'ofcPap',
    description: '这是一次vibe coding 论文实践',
    language: 'Python',
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/ofcPap',
    updatedAt: '2026-05-29',
    topics: [],
  },
  {
    name: 'PTCLI',
    description: 'Cisco Packet Tracer CLI — 命令行管理 .pkt 文件和网络设备',
    language: 'Python',
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/PTCLI',
    updatedAt: null,
    topics: [],
  },
  {
    name: 'PaiSmart',
    description: '项目学习',
    language: 'Java',
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/PaiSmart',
    updatedAt: null,
    topics: [],
  },
  {
    name: 'YahuDemo',
    description: 'This is my thirst vibe coding demo.',
    language: 'Vue',
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/YahuDemo',
    updatedAt: null,
    topics: [],
  },
  {
    name: 'newthing',
    description: null,
    language: null,
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/newthing',
    updatedAt: '2026-05-28',
    topics: [],
  },
  {
    name: 'hello-world',
    description: 'This is YAHU2024‘s first repository !',
    language: null,
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/hello-world',
    updatedAt: null,
    topics: [],
  },
  {
    name: 'yahu.github.io',
    description: null,
    language: null,
    stars: 0,
    forks: 0,
    url: 'https://github.com/YAHU2024/yahu.github.io',
    updatedAt: '2026-08-14',
    topics: [],
  },
]
