import { useMemo } from 'react'
import { languageColors, type Repo } from '@/data/github'
import Reveal from '@/components/Reveal'

interface StackProps {
  repos: Repo[]
}

export default function Stack({ repos }: StackProps) {
  const languages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of repos) {
      if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [repos])

  const topics = useMemo(() => {
    const all = repos.flatMap((r) => r.topics)
    return [...new Set(all)]
  }, [repos])

  const max = languages[0]?.[1] ?? 1

  return (
    <section id="stack" className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <Reveal>
          <div className="font-mono text-xs tracking-[0.3em] text-muted-foreground">03 / STACK</div>
          <h2 className="mt-2 font-display text-4xl font-bold md:text-6xl">技术分布</h2>
        </Reveal>

        <div className="mt-10 grid gap-12 md:grid-cols-2">
          <Reveal delay={100}>
            <div className="space-y-4">
              {languages.map(([lang, count]) => (
                <div key={lang}>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: languageColors[lang] ?? '#8b8b93' }}
                      />
                      {lang}
                    </span>
                    <span className="text-muted-foreground">{count} 个仓库</span>
                  </div>
                  <div className="h-3 border bg-background">
                    <div
                      className="h-full transition-[width] duration-700"
                      style={{
                        width: `${(count / max) * 100}%`,
                        background: languageColors[lang] ?? '#8b8b93',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div>
              <div className="mb-4 font-mono text-xs tracking-widest text-muted-foreground">
                话题标签
              </div>
              <div className="flex flex-wrap gap-2">
                {topics.length > 0 ? (
                  topics.map((t) => (
                    <span
                      key={t}
                      className="border px-3 py-1.5 font-mono text-xs transition-colors hover:border-accent hover:text-accent"
                    >
                      #{t}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">暂无话题标签</span>
                )}
              </div>
              <p className="mt-8 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted-foreground">
                从 WPF 桌面应用到 Python 知识流水线，再到 Agent 技能合集 ——
                技术选型始终围绕一个目标：让 AI 真正融入日常工作流。
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
