import { now } from '@/data/now'
import { copy } from '@/data/copy'
import Reveal from '@/components/Reveal'
import GlassCard from '@/components/GlassCard'

/** '2026-09-04' → '2026.09.04'；格式不对时原样返回，不抛错 */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${y}.${m}.${d}` : iso
}

/**
 * 最近状态（00）：人现在在忙什么
 * 三列：正在做 / 在学·在读 / 最近动态
 * 头部右侧是最后更新时间 —— 有右侧元素，故整体左对齐（与其他区块对齐规律一致）
 */
export default function Now() {
  return (
    <section id="now" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-9 flex items-baseline justify-between gap-4">
            <h2 className="text-3xl font-black">
              <span className="mr-3 text-base font-bold text-accent">{copy.now.num}</span>
              {copy.now.title}
            </h2>
            <span className="shrink-0 text-sm font-bold text-muted">
              {copy.now.updatedAt(formatDate(now.updatedAt))}
            </span>
          </div>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {/* 正在做 */}
          <Reveal>
            <GlassCard className="h-full p-7">
              <h3 className="gc-z1 text-sm font-extrabold text-accent">{copy.now.doingTitle}</h3>
              {now.doing.length ? (
                <ul className="gc-z2 mt-4 space-y-3.5">
                  {now.doing.map((d) => (
                    <li key={d.text} className="flex gap-3">
                      <span className="text-lg leading-none" aria-hidden>
                        {d.emoji}
                      </span>
                      <span className="text-[0.95rem] leading-relaxed text-muted">{d.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gc-z2 mt-4 text-sm text-muted">{copy.now.empty}</p>
              )}
            </GlassCard>
          </Reveal>

          {/* 在学 · 在读 */}
          <Reveal delay={80}>
            <GlassCard className="h-full p-7">
              <h3 className="gc-z1 text-sm font-extrabold text-accent">{copy.now.learningTitle}</h3>
              {now.learning.length ? (
                <ul className="gc-z2 mt-4 space-y-3.5">
                  {now.learning.map((l) => (
                    <li key={l.text} className="flex gap-3">
                      <span className="text-lg leading-none" aria-hidden>
                        {l.emoji}
                      </span>
                      <span className="text-[0.95rem] leading-relaxed text-muted">{l.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gc-z2 mt-4 text-sm text-muted">{copy.now.empty}</p>
              )}
            </GlassCard>
          </Reveal>

          {/* 最近动态 */}
          <Reveal delay={160}>
            <GlassCard className="h-full p-7">
              <h3 className="gc-z1 text-sm font-extrabold text-accent">{copy.now.timelineTitle}</h3>
              {now.timeline.length ? (
                <ol className="gc-z2 mt-4 space-y-4">
                  {now.timeline.map((t) => (
                    <li
                      key={`${t.date}-${t.text}`}
                      className="border-l pl-4"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <time dateTime={t.date} className="text-xs font-bold text-accent">
                        {formatDate(t.date)}
                      </time>
                      <div className="mt-1 text-[0.95rem] leading-relaxed text-muted">{t.text}</div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="gc-z2 mt-4 text-sm text-muted">{copy.now.empty}</p>
              )}
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
