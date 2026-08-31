import { Github, Mail } from 'lucide-react'
import { profile, snapshot } from '@/data/github'

interface FooterProps {
  live: boolean
}

export default function Footer({ live }: FooterProps) {
  return (
    <footer className="layer-content mt-10 border-t px-6 py-10" style={{ borderColor: 'var(--line)' }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
        <div>
          <div className="font-extrabold">
            YAHU<span className="text-accent">.</span>
          </div>
          <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted md:justify-start">
            <span
              className={`inline-block h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`}
              title={live ? 'GitHub API 实时数据' : 'GitHub API 不可用，显示离线快照'}
            />
            {live ? '数据实时来自 GitHub API' : `离线快照 · 更新于 ${snapshot.fetchedAt}`}
            <span className="opacity-60">·</span>
            <span>© 2026 YAHU · 用 ☕ 和好奇心做成</span>
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm font-bold text-muted">
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="nav-link flex items-center gap-1.5"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
          <a
            href="mailto:yahu_bumahu@qq.com"
            className="nav-link flex items-center gap-1.5"
          >
            <Mail className="h-4 w-4" /> Email
          </a>
        </div>
      </div>
    </footer>
  )
}
