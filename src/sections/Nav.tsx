import { Github } from 'lucide-react'
import { profile } from '@/data/github'
import { copy } from '@/data/copy'
import ThemeToggle from '@/components/ThemeToggle'

export default function Nav() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{ background: 'var(--nav-bg)', borderColor: 'var(--line)' }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-xl font-extrabold tracking-wide">
          {copy.nav.brand}
          <span className="text-accent">{copy.nav.brandDot}</span>
        </a>
        <nav className="flex items-center gap-6 text-[0.95rem] font-semibold text-muted">
          <a href="#featured" className="nav-link hidden sm:block">
            {copy.nav.projects}
          </a>
          <a href="#toolbox" className="nav-link hidden sm:block">
            {copy.nav.toolbox}
          </a>
          <a href="#about" className="nav-link hidden sm:block">
            {copy.nav.about}
          </a>
          <ThemeToggle />
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-pop flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-[var(--accent-ink)]"
          >
            <Github className="h-4 w-4" />
            {copy.nav.github}
          </a>
        </nav>
      </div>
    </header>
  )
}
