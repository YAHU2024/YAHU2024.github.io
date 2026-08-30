import { ArrowUpRight } from 'lucide-react'
import { featured } from '@/data/github'
import Reveal from '@/components/Reveal'

export default function Featured() {
  return (
    <section id="featured" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-9 flex items-baseline justify-between gap-4">
            <h2 className="text-3xl font-black">
              <span className="mr-3 text-base font-bold text-accent">01</span>精选项目
            </h2>
            <a
              href="https://github.com/YAHU2024?tab=repositories"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-muted transition-colors hover:text-foreground"
            >
              全部在 GitHub →
            </a>
          </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.name} delay={i * 100}>
              <article className="glass group flex h-full flex-col rounded-3xl p-7 transition-all duration-300 hover:-translate-y-2 hover:bg-[var(--glass-strong)]">
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: 'var(--accent-soft)' }}
                  >
                    {p.emoji}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-extrabold text-accent"
                    style={{ background: 'var(--accent-soft)' }}
                  >
                    {p.badge}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold">
                  {p.name}
                  <span className="ml-2 text-xs font-semibold text-muted">{p.lang}</span>
                </h3>
                <p className="mt-2.5 flex-1 text-[0.95rem] leading-relaxed text-muted">{p.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border px-3 py-0.5 text-xs font-semibold text-muted"
                      style={{ borderColor: 'var(--gborder)' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-extrabold text-accent hover:underline"
                >
                  GitHub <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
