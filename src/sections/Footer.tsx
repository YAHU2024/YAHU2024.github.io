import { Github } from 'lucide-react'
import { profile } from '@/data/github'

export default function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center">
        <div>
          <div className="font-mono text-sm font-semibold tracking-widest">
            {profile.login}
            <span className="animate-blink text-accent">_</span>
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            数据来自 GitHub API · 快照更新于 2026-08-14
          </p>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs tracking-widest text-muted-foreground">
          <span>© 2026 {profile.name}</span>
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Github className="h-4 w-4" /> @{profile.login}
          </a>
        </div>
      </div>
    </footer>
  )
}
