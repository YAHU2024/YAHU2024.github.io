import { Github, Mail } from 'lucide-react'
import { profile, snapshot } from '@/data/github'
import { copy } from '@/data/copy'

interface FooterProps {
  live: boolean
}

export default function Footer({ live }: FooterProps) {
  return (
    <footer className="layer-content mt-10 border-t px-6 py-10" style={{ borderColor: 'var(--line)' }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
        <div>
          <div className="font-extrabold">
            {copy.footer.brand}
            <span className="text-accent">{copy.footer.brandDot}</span>
          </div>
          <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted md:justify-start">
            <span
              className={`inline-block h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`}
              title={live ? copy.footer.liveTitle : copy.footer.offlineTitle}
            />
            {live ? copy.footer.live : copy.footer.offline(snapshot.fetchedAt)}
            <span className="opacity-60">·</span>
            <span>{copy.footer.copyright}</span>
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm font-bold text-muted">
          <a
            href={profile.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="nav-link flex items-center gap-1.5"
          >
            <Github className="h-4 w-4" /> {copy.footer.github}
          </a>
          <a
            href="mailto:yahu_bumahu@qq.com"
            className="nav-link flex items-center gap-1.5"
          >
            <Mail className="h-4 w-4" /> {copy.footer.email}
          </a>
        </div>
      </div>
    </footer>
  )
}
