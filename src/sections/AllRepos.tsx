import { hiddenRepos, type Repo } from '@/data/github'
import Reveal from '@/components/Reveal'

/** 排序：有更新时间的在前，新的优先；空描述给一句占位 */
export default function AllRepos({ repos }: { repos: Repo[] }) {
  const list = repos
    .filter((r) => !hiddenRepos.some((h) => h.toLowerCase() === r.name.toLowerCase()))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 8)

  return (
    <section id="repos" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-9 flex items-baseline justify-between gap-4">
            <h2 className="text-3xl font-black">
              <span className="mr-3 text-base font-bold text-accent">02</span>全部作品
            </h2>
            <a
              href="https://github.com/YAHU2024?tab=repositories"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-muted transition-colors hover:text-foreground"
            >
              更多 →
            </a>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="glass rounded-3xl px-4 py-2 md:px-7">
            {list.map((r, i) => (
              <a
                key={r.name}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-wrap items-center gap-x-5 gap-y-1 px-2 py-4 transition-colors hover:bg-[var(--glass-strong)] md:px-3"
                style={{ borderRadius: 12 }}
              >
                <span className="min-w-7 text-sm font-bold text-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-28 font-bold">{r.name}</span>
                <span className="flex-1 text-sm text-muted">{r.description ?? '（还没有写描述）'}</span>
                <span className="text-xs font-semibold text-muted">{r.language ?? '—'}</span>
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
