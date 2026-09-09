// ─────────────────────────────────────────────────────────────
// 界面文案集中配置（唯一修改入口）
// 改字只改这个文件；组件一律引用 copy，不允许出现裸字符串文案。
// 说明：内容层数据分三个文件，本文件只管界面 UI 文案
//   src/data/projects.ts —— 项目（按 doing / shipped / idea 分组）
//   src/data/now.ts      —— 最近状态（doing / learning / timeline）
//   src/data/github.ts   —— 个人资料、工具箱、GitHub 快照
// ─────────────────────────────────────────────────────────────

export const copy = {
  nav: {
    brand: 'YAHU',
    brandDot: '.',
    home: '首页',
    recent: '最近',
    projects: '项目',
    toolbox: '工具箱',
    about: '关于',
    github: 'GitHub',
    menuOpen: '打开菜单',
    menuClose: '关闭菜单',
  },
  /** 「最近」页（#recent 视图）：布局参考 sandev.cc/zh/notes，玻璃卡风格化 */
  recentPage: {
    title: '最近。',
    desc: '记录最近在做的事，和一些想法计划。',
    notesTitle: '动态',
    plansTitle: '计划',
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
    /** 「最近」小标签，后跟 src/data/now.ts 的 recent 两行内容 */
  },
  now: {
    num: '00',
    title: '最近状态',
    updatedAt: (date: string) => `最后更新 ${date}`,
    doingTitle: '正在做',
    learningTitle: '在学 · 在读',
    timelineTitle: '最近动态',
    empty: '暂无',
  },
  projects: {
    num: '01',
    title: '项目',
    allOnGitHub: (n: number) => `全部 ${n} 个仓库在 GitHub`,
    status: {
      doing: '正在做',
      shipped: '已上线',
      idea: '想做',
    },
    progress: '进度',
    repo: '源码',
    site: '官网',
    /** PC 端补位卡：每个分组右侧的占位玻璃卡文案 */
    placeholderTitle: '占位中',
    placeholderText: '这个位置留给同状态的下一个项目',
    /** 状态筛选用例：无障碍文本，说明该分组有多少个项目 */
    groupAria: (label: string, n: number) => `${label}，共 ${n} 个项目`,
  },
  toolbox: {
    num: '02',
    title: '工具箱',
    subtitle: '常用的一些家伙事儿',
  },
  about: {
    num: '03',
    title: '关于我',
    paragraphs: [
      {
        segments: [
          { text: '我是 ' },
          { text: 'YAHU', strong: true },
          { text: '，喜欢把日常中的需求做成' },
          { text: '顺手的软件', accent: true },
          { text: '。热爱 vibe coding，习惯先让它跑起来，再把它打磨好。' },
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
