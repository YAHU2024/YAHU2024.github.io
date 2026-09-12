// ─────────────────────────────────────────────────────────────
// 站点内容与数据层
// 1. profile / toolbox：人工维护的文案，想改就改
//    （面向用户展示的文案字段为双语 L：zh/en 必须同时写）
//    （项目与「最近状态」已迁出：见 projects.ts / now.ts）
// 2. snapshot.json：GitHub 数据离线快照，由 scripts/fetch-github.mjs 在
//    构建时自动更新（本地也可手动 node scripts/fetch-github.mjs 运行）
// 3. 运行时 useGitHub 仍会调用 GitHub API 实时刷新，快照只作兜底
// ─────────────────────────────────────────────────────────────
import snapshotJson from './snapshot.json'
import type { L } from '@/hooks/useLocale'

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
  /** Hero 主标题三行结构：line1 / line2Pre + accent + line2Post */
  headline: {
    line1: { zh: '把日常中的需求，', en: 'Turning everyday needs' } as L,
    line2Pre: { zh: '做成', en: 'into' } as L,
    accent: { zh: '顺手的软件', en: 'handy software' } as L,
    line2Post: { zh: '。', en: '.' } as L,
  },
  tagline: {
    zh: '开发 AI 时代的个人工具 · vibe coding 实践者',
    en: 'Building personal tools for the AI era · vibe coding practitioner',
  } as L,
  /** 已不在 Hero 展示：那个位置换成了「最近」标签 + src/data/now.ts 的 recent（暂未上界面，不参与双语） */
  subtitle: '喜欢把一个想法从"跑起来"打磨到"用得舒服"。',
}

export interface ToolboxItem {
  emoji: string
  name: L
  use: L
}

/** 工具箱：常用家伙事儿 */
export const toolbox: ToolboxItem[] = [
  { emoji: '🤖', name: { zh: 'Claude · AI 编程', en: 'Claude · AI coding' }, use: { zh: 'vibe coding 主力', en: 'main vibe coding driver' } },
  { emoji: '🖥️', name: { zh: 'C# · .NET', en: 'C# · .NET' }, use: { zh: '桌面应用（WPF）', en: 'desktop apps (WPF)' } },
  { emoji: '🐍', name: { zh: 'Python', en: 'Python' }, use: { zh: '脚本与知识流水线', en: 'scripts & knowledge pipelines' } },
  { emoji: '💚', name: { zh: 'Vue', en: 'Vue' }, use: { zh: '网页小试验', en: 'web experiments' } },
  { emoji: '☕', name: { zh: 'Java', en: 'Java' }, use: { zh: '项目式学习', en: 'project-based learning' } },
  { emoji: '🐚', name: { zh: 'Shell', en: 'Shell' }, use: { zh: '自动化小工具', en: 'small automation tools' } },
  { emoji: '🌐', name: { zh: '网络 · Cisco PT', en: 'Networking · Cisco PT' }, use: { zh: '课程实践', en: 'course practice' } },
  { emoji: '🛠️', name: { zh: 'Git & GitHub', en: 'Git & GitHub' }, use: { zh: '版本与发布', en: 'versioning & releases' } },
]

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
