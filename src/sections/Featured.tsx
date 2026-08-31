import { ArrowUpRight } from 'lucide-react'
import { featured } from '@/data/github'
import Reveal from '@/components/Reveal'
import GlassCard from '@/components/GlassCard'

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
              全部在 GitHub <span className="ar-pop">→</span>
            </a>
          </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.name} delay={i * 100}>
              <GlassCard className="h-full p-7" tilt>
                <div className="gc-z1 mb-4 flex items-center justify-between">
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
                <h3 className="gc-z2 text-xl font-extrabold">
                  {p.name}
                  <span className="ml-2 text-xs font-semibold text-muted">{p.lang}</span>
                </h3>
                <p className="gc-z3 mt-2.5 flex-1 text-[0.95rem] leading-relaxed text-muted">{p.desc}</p>
                <div className="gc-z3 mt-4 flex flex-wrap gap-2">
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
                <div className="gc-z2 mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {p.homepage && (
                    <a
                      href={p.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-extrabold text-accent hover:underline"
                    >
                      项目官网 <ArrowUpRight className="ar-pop h-3.5 w-3.5" />
                    </a>
                  )}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-extrabold text-accent hover:underline"
                  >
                    GitHub <ArrowUpRight className="ar-pop h-3.5 w-3.5" />
                  </a>
                </div>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
