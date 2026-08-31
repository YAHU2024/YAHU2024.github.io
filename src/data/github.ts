// ─────────────────────────────────────────────────────────────
// 站点内容与数据层
// 1. profile / featured / toolbox / catPhrases：人工维护的文案，想改就改
// 2. snapshot.json：GitHub 数据离线快照，由 scripts/fetch-github.mjs 在
//    构建时自动更新（本地也可手动 node scripts/fetch-github.mjs 运行）
// 3. 运行时 useGitHub 仍会调用 GitHub API 实时刷新，快照只作兜底
// ─────────────────────────────────────────────────────────────
import snapshotJson from './snapshot.json'

export interface Repo {
  name: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  url: string
  updatedAt: string | null
  topics: string[]
  /** 项目官网（GitHub Pages 或外部站点），没有则为 null */
  homepage: string | null
}

export const profile = {
  login: 'YAHU2024',
  name: 'YAHU_bumahu',
  avatarUrl: 'https://avatars.githubusercontent.com/u/185674810?v=4',
  htmlUrl: 'https://github.com/YAHU2024',
  createdAt: '2024-10-20',
  // ↓ 可编辑的展示文案
  headline: {
    line1: '把日常的小麻烦，',
    line2Pre: '做成',
    accent: '顺手的软件',
    line2Post: '。',
  },
  tagline: '构建 AI 时代的个人工具 · vibe coding 实践者',
  subtitle: '喜欢把一个想法从"跑起来"打磨到"用得爽"。',
  /** 猫气泡里的真实状态（会和 catPhrases 轮播） */
  nowStatus: '在打磨 Unarchive 的字幕抓取，顺便给工具们补说明书',
}

/** 猫咪气泡的俏皮语录（与 nowStatus 轮播） */
export const catPhrases = [
  '呼噜呼噜…',
  'vibe 一下？',
  '在写 bug，别吵',
  '今天也要顺手的软件',
  '喵？有 commit',
  '摸鱼是生产力',
]

export interface FeaturedRepo {
  name: string
  emoji: string
  badge: string
  lang: string
  langColor: string
  desc: string
  tags: string[]
  url: string
  /** 项目官网（有 GitHub Pages 的仓库手填） */
  homepage?: string
}

/** 精选项目：文案手写，不用 GitHub 的 description */
export const featured: FeaturedRepo[] = [
  {
    name: 'myTool',
    emoji: '🤖',
    badge: '🔧 主力项目',
    lang: 'C#',
    langColor: '#178600',
    desc: 'AI 时代的学习工具：把资料喂给它，实时流式解读、追问轻对话，历史保存在本地，隐私放心。',
    tags: ['WPF', 'OpenAI'],
    url: 'https://github.com/YAHU2024/myTool',
    homepage: 'https://yahu2024.github.io/myTool/',
  },
  {
    name: 'Unarchive',
    emoji: '🎞️',
    badge: '🌱 新做的',
    lang: 'Python',
    langColor: '#3572A5',
    desc: '把视频收藏夹变成个人知识库：收藏不再吃灰，自动整理成可检索的笔记。',
    tags: ['字幕', '知识库'],
    url: 'https://github.com/YAHU2024/Unarchive',
  },
  {
    name: 'claude-skills',
    emoji: '🧩',
    badge: '⚡ 持续更新',
    lang: 'Shell',
    langColor: '#89e051',
    desc: '我在用的 Claude 技能合集：日常 vibe coding 的提效小工具箱。',
    tags: ['Agent', 'Skills'],
    url: 'https://github.com/YAHU2024/claude-skills',
  },
]

export interface ToolboxItem {
  emoji: string
  name: string
  use: string
}

/** 工具箱：常用家伙事儿 */
export const toolbox: ToolboxItem[] = [
  { emoji: '🤖', name: 'Claude · AI 编程', use: 'vibe coding 主力' },
  { emoji: '🖥️', name: 'C# · .NET', use: '桌面应用（WPF）' },
  { emoji: '🐍', name: 'Python', use: '脚本与知识流水线' },
  { emoji: '💚', name: 'Vue', use: '网页小试验' },
  { emoji: '☕', name: 'Java', use: '项目式学习' },
  { emoji: '🐚', name: 'Shell', use: '自动化小工具' },
  { emoji: '🌐', name: '网络 · Cisco PT', use: '课程实践' },
  { emoji: '🛠️', name: 'Git & GitHub', use: '版本与发布' },
]

/** 全部作品里隐藏的仓库（练习/脚手架类），比较时忽略大小写 */
export const hiddenRepos = ['yahu.github.io', 'YAHU2024.github.io', 'hello-world']

export const languageColors: Record<string, string> = {
  'C#': '#178600',
  Python: '#3572A5',
  Vue: '#41b883',
  Shell: '#89e051',
  Java: '#b07219',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
}

// ── 离线快照（由 scripts/fetch-github.mjs 生成/更新） ──
interface SnapshotUser {
  followers: number
  public_repos: number
}

interface SnapshotRepo {
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  html_url: string
  updated_at: string | null
  topics: string[]
  fork: boolean
  homepage: string | null
}

export interface Snapshot {
  fetchedAt: string
  contributionsLastYear: number
  user: SnapshotUser
  repos: SnapshotRepo[]
}

export const snapshot = snapshotJson as Snapshot

export const snapshotRepos: Repo[] = snapshot.repos
  .filter((r) => !r.fork)
  .map((r) => ({
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    url: r.html_url,
    updatedAt: r.updated_at ? r.updated_at.slice(0, 10) : null,
    topics: r.topics ?? [],
    homepage: r.homepage ?? null,
  }))
