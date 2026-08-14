import { Github } from 'lucide-react'
import { profile } from '@/data/github'

export default function Nav() {
  return (
    <header className="fixed top-0 z-50 w-full border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="font-mono text-sm font-semibold tracking-widest">
          {profile.login}
          <span className="animate-blink text-accent">_</span>
        </a>
        <nav className="flex items-center gap-6 font-mono text-xs tracking-widest text-muted-foreground">
          <a href="#pinned" className="hidden transition-colors hover:text-foreground sm:block">
            置顶
          </a>
          <a href="#projects" className="hidden transition-colors hover:text-foreground sm:block">
            仓库
          </a>
          <a href="#stack" className="hidden transition-colors hover:text-foreground sm:block">
            技术
          </a>
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 主页"
            className="flex h-9 w-9 items-center justify-center border transition-colors hover:border-accent hover:text-accent"
          >
            <Github className="h-4 w-4" />
          </a>
        </nav>
      </div>
    </header>
  )
}
