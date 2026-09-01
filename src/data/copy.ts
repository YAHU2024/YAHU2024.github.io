// ─────────────────────────────────────────────────────────────
// 界面文案集中配置（唯一修改入口）
// 改字只改这个文件；组件一律引用 copy，不允许出现裸字符串文案。
// 说明：内容层数据（profile / featured / toolbox / catPhrases）
// 仍在 src/data/github.ts，本文件只管界面 UI 文案。
// ─────────────────────────────────────────────────────────────

export const copy = {
  nav: {
    brand: 'YAHU',
    brandDot: '.',
    projects: '项目',
    toolbox: '工具箱',
    about: '关于',
    github: 'GitHub',
  },
  hero: {
    hello: '👋 你好，我是 YAHU',
    statRepos: '公开仓库',
    statCommits: '年度提交',
    statUpdated: '最近更新',
    timeAgo: {
      today: '今天',
      yesterday: '昨天',
      days: (n: number) => `${n} 天前`,
      weeks: (n: number) => `${n} 周前`,
      months: (n: number) => `${n} 个月前`,
      none: '—',
    },
    ctaProjects: '看看我的项目',
    github: 'GitHub',
  },
  featured: {
    num: '01',
    title: '精选项目',
    allOnGitHub: '全部在 GitHub',
    projectHomepage: '项目官网',
    github: 'GitHub',
  },
  allRepos: {
    num: '02',
    title: '全部作品',
    more: '更多',
    noDescription: '（还没有写描述）',
    homepageTitle: '项目官网',
    homepageAria: (name: string) => `打开 ${name} 的项目官网`,
    dash: '—',
  },
  toolbox: {
    num: '03',
    title: '工具箱',
    subtitle: '常用的一些家伙事儿',
  },
  about: {
    num: '04',
    title: '关于我',
    paragraphs: [
      {
        segments: [
          { text: '我是 ' },
          { text: 'YAHU', strong: true },
          { text: '，喜欢把日常中的需求做成' },
          { text: '顺手的软件', accent: true },
          { text: '。热爱 vibe coding：先让它跑起来，再把它打磨好。' },
        ],
      },
      {
        segments: [
          { text: '比起"大而全"，我更享受把一个小工具做到顺手的过程。最近主要在折腾' },
          { text: ' AI 桌面应用', strong: true },
          { text: '和' },
          { text: '知识流水线', strong: true },
          { text: '。' },
        ],
      },
    ],
  },
  footer: {
    brand: 'YAHU',
    brandDot: '.',
    live: '数据实时来自 GitHub API',
    offline: (fetchedAt: string) => `离线快照 · 更新于 ${fetchedAt}`,
    liveTitle: 'GitHub API 实时数据',
    offlineTitle: 'GitHub API 不可用，显示离线快照',
    copyright: '© 2026 YAHU · 用 ☕ 和好奇心做成',
    github: 'GitHub',
    email: 'Email',
  },
  cat: {
    avatarAlt: 'YAHU 的头像',
    badgeAria: '猫徽章，按住拖拽可 360° 翻转，松手自动归位',
  },
} as const

export type Copy = typeof copy
