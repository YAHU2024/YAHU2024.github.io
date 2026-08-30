import { Github } from 'lucide-react'
import { profile } from '@/data/github'
import ThemeToggle from '@/components/ThemeToggle'

export default function Nav() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: 'var(--nav-bg)', borderColor: 'var(--line)' }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-xl font-extrabold tracking-wide">
          YAHU<span className="text-accent">.</span>
        </a>
        <nav className="flex items-center gap-6 text-[0.95rem] font-semibold text-muted">
          <a href="#featured" className="hidden transition-colors hover:text-foreground sm:block">
            项目
          </a>
          <a href="#toolbox" className="hidden transition-colors hover:text-foreground sm:block">
            工具箱
          </a>
          <a href="#about" className="hidden transition-colors hover:text-foreground sm:block">
            关于
          </a>
          <ThemeToggle />
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-[var(--accent-ink)] transition-transform hover:-translate-y-0.5"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </nav>
      </div>
    </header>
  )
}
