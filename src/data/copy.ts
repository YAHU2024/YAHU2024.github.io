// ─────────────────────────────────────────────────────────────
// 界面文案集中配置（唯一修改入口）· 中英双语
// 改字只改这个文件；组件一律 useT() 取字典，不允许出现裸字符串文案。
//
// 结构：zh / en 两棵同构字典树（en 的类型 = typeof zh，少译一条 tsc 直接报错）。
//   - 新增文案：zh、en 两棵树必须同时写
//   - 新增语言：加一棵树 + useLocale.ts 的 Locale 联合类型加值
//   - 函数型文案（相对时间等）：两棵树各写一份同签名函数
//
// 说明：内容层数据分三个文件（P2 再做双语 L 字段改造）：
//   src/data/projects.ts —— 项目（按 doing / shipped / idea 分组）
//   src/data/now.ts      —— 最近状态（doing / learning / timeline）
//   src/data/github.ts   —— 个人资料、工具箱、GitHub 快照
// ─────────────────────────────────────────────────────────────

const zh = {
  lang: {
    toggleAria: '切换到英文',
    toggleTitle: '切换到 English',
  },
  /** P3：语言切换时同步 document.title 与 meta description */
  seo: {
    title: 'YAHU · 把日常做成顺手的软件',
    description: 'YAHU 的个人网站 — 把日常的小麻烦做成顺手的软件',
  },
  theme: {
    toDark: '切换到深色主题',
    toLight: '切换到浅色主题',
    toDarkTitle: '切到夜晚 🌙',
    toLightTitle: '切到白天 ☀️',
  },
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
    title: '最近',
    /** 大标题尾部的强调点（zh 全角句号 / en 半角点），与 title 拆开渲染 accent 色 */
    dot: '。',
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
    /** Hero 次按钮：进「最近」视图（#recent hash 入口） */
    recent: '最近',
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
    /**
     * 一整段正文（唯一改动入口）。
     * 支持轻量标记：**粗体**（foreground）、*强调*（accent）。
     * 例：'我是 **YAHU**，喜欢把日常需求做成*顺手的软件*。'
     * 注意：正文中若要显示字面量星号，暂不支持转义，请改用中文全角＊。
     */
    text: '我是 **YAHU**，喜欢把日常需求做成*顺手的软件*。习惯先让它跑起来，再把它打磨好。',
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
}

export type Copy = typeof zh

const en: Copy = {
  lang: {
    toggleAria: 'Switch to Chinese',
    toggleTitle: '切换到中文',
  },
  seo: {
    title: 'YAHU · Turning everyday needs into handy software',
    description: "YAHU's personal site — small daily annoyances turned into handy software",
  },
  theme: {
    toDark: 'Switch to dark theme',
    toLight: 'Switch to light theme',
    toDarkTitle: 'Night mode 🌙',
    toLightTitle: 'Day mode ☀️',
  },
  nav: {
    brand: 'YAHU',
    brandDot: '.',
    home: 'Home',
    recent: 'Recent',
    projects: 'Projects',
    toolbox: 'Toolbox',
    about: 'About',
    github: 'GitHub',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
  },
  recentPage: {
    title: 'Recent',
    dot: '.',
    desc: "What I've been up to lately, plus some plans and ideas.",
    notesTitle: 'Updates',
    plansTitle: 'Plans',
  },
  hero: {
    hello: "👋 Hi, I'm YAHU",
    statRepos: 'Public repos',
    statCommits: 'Commits this year',
    statUpdated: 'Last updated',
    timeAgo: {
      today: 'Today',
      yesterday: 'Yesterday',
      days: (n: number) => `${n} days ago`,
      weeks: (n: number) => `${n} week${n > 1 ? 's' : ''} ago`,
      months: (n: number) => `${n} month${n > 1 ? 's' : ''} ago`,
      none: '—',
    },
    ctaProjects: 'See my projects',
    /** Hero 次按钮：进「最近」视图（#recent hash 入口） */
    recent: 'Recent',
  },
  now: {
    num: '00',
    title: 'Now',
    updatedAt: (date: string) => `Last updated ${date}`,
    doingTitle: 'Doing',
    learningTitle: 'Learning · Reading',
    timelineTitle: 'Updates',
    empty: 'Nothing yet',
  },
  projects: {
    num: '01',
    title: 'Projects',
    allOnGitHub: (n: number) => `All ${n} repos on GitHub`,
    status: {
      doing: 'In progress',
      shipped: 'Shipped',
      idea: 'Idea',
    },
    progress: 'Progress',
    repo: 'Source',
    site: 'Site',
    placeholderTitle: 'Reserved',
    placeholderText: 'This spot is waiting for the next project in this state',
    groupAria: (label: string, n: number) => `${label}, ${n} project${n > 1 ? 's' : ''} in total`,
  },
  toolbox: {
    num: '02',
    title: 'Toolbox',
    subtitle: 'Tools I reach for every day',
  },
  about: {
    num: '03',
    title: 'About me',
    text: "I'm **YAHU** — I like turning everyday needs into *handy software*. Get it running first, then polish it until it feels good.",
  },
  footer: {
    brand: 'YAHU',
    brandDot: '.',
    live: 'Data live from the GitHub API',
    offline: (fetchedAt: string) => `Offline snapshot · updated ${fetchedAt}`,
    liveTitle: 'Live data from the GitHub API',
    offlineTitle: 'GitHub API unavailable — showing an offline snapshot',
    copyright: '© 2026 YAHU · made with ☕ and curiosity',
    github: 'GitHub',
    email: 'Email',
  },
  cat: {
    avatarAlt: "YAHU's avatar",
    badgeAria: 'Cat badge — press and drag to spin 360°, release to snap back',
  },
}

/** 语言 → 字典树；组件经 src/hooks/useLocale.ts 的 useT() 取用 */
export const dictionaries = { zh, en }
