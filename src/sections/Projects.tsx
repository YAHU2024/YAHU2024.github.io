import { ArrowUpRight, Star } from 'lucide-react'
import { languageColors, pinnedNames, type Repo } from '@/data/github'
import Reveal from '@/components/Reveal'

interface ProjectsProps {
  repos: Repo[]
}

export default function Projects({ repos }: ProjectsProps) {
  const rest = repos.filter((r) => !pinnedNames.includes(r.name))

  return (
    <section id="projects" className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <Reveal>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
                02 / REPOSITORIES
              </div>
              <h2 className="mt-2 font-display text-4xl font-bold md:text-6xl">全部仓库</h2>
            </div>
            <div className="font-mono text-sm text-muted-foreground">{rest.length} 个</div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((repo, i) => (
            <Reveal key={repo.name} delay={(i % 3) * 100} className="bg-card">
              <a
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="card-brutal group flex h-full flex-col bg-card p-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold tracking-tight group-hover:text-accent">
                    {repo.name}
                  </h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {repo.description ?? '暂无描述'}
                </p>
                <div className="mt-4 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  {repo.language && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: languageColors[repo.language] ?? '#8b8b93' }}
                      />
                      {repo.language}
                    </span>
                  )}
                  {repo.stars > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" /> {repo.stars}
                    </span>
                  )}
                  {repo.updatedAt && <span className="ml-auto">{repo.updatedAt}</span>}
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
