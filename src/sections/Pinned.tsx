import { ArrowUpRight, GitFork, Star } from 'lucide-react'
import { languageColors, pinnedNames, type Repo } from '@/data/github'
import Reveal from '@/components/Reveal'

interface PinnedProps {
  repos: Repo[]
}

export default function Pinned({ repos }: PinnedProps) {
  const pinned = pinnedNames
    .map((name) => repos.find((r) => r.name === name))
    .filter((r): r is Repo => Boolean(r))

  return (
    <section id="pinned" className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <Reveal>
          <div className="font-mono text-xs tracking-[0.3em] text-muted-foreground">01 / PINNED</div>
          <h2 className="mt-2 font-display text-4xl font-bold md:text-6xl">置顶项目</h2>
        </Reveal>

        <div className="mt-10 grid gap-px border bg-border md:grid-cols-3">
          {pinned.map((repo, i) => (
            <Reveal key={repo.name} delay={i * 120} className="bg-card">
              <a
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="card-brutal group flex h-full flex-col bg-card p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">{repo.name}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {repo.description ?? '暂无描述'}
                </p>
                {repo.topics.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {repo.topics.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-6 flex items-center gap-4 border-t pt-4 font-mono text-xs text-muted-foreground">
                  {repo.language && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: languageColors[repo.language] ?? '#8b8b93' }}
                      />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" /> {repo.stars}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="h-3.5 w-3.5" /> {repo.forks}
                  </span>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
