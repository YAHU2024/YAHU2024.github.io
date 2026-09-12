import { ArrowUpRight } from 'lucide-react'
import {
  projects,
  statusOrder,
  type ProjectItem,
  type ProjectStatus,
} from '@/data/projects'
import { useT, useTL } from '@/hooks/useLocale'
import Reveal from '@/components/Reveal'
import GlassCard from '@/components/GlassCard'

/**
 * 状态徽章：同一色系分三档强度，不引入新颜色
 *   shipped 实心（最强，表示可用） → doing 浅底 → idea 描边（最弱，只是想法）
 */
function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useT()
  const base = 'shrink-0 rounded-full px-3 py-1 text-xs font-extrabold'
  if (status === 'shipped') {
    return (
      <span className={`${base} bg-accent text-[var(--accent-ink)]`}>{t.projects.status.shipped}</span>
    )
  }
  if (status === 'doing') {
    return (
      <span className={`${base} text-accent`} style={{ background: 'var(--accent-soft)' }}>
        {t.projects.status.doing}
      </span>
    )
  }
  return (
    <span className={`${base} border text-muted`} style={{ borderColor: 'var(--gborder)' }}>
      {t.projects.status.idea}
    </span>
  )
}

function Chip({ children, strong }: { children: string; strong?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
        strong ? 'text-accent' : 'border text-muted'
      }`}
      style={strong ? { background: 'var(--accent-soft)' } : { borderColor: 'var(--gborder)' }}
    >
      {children}
    </span>
  )
}

function ProjectCard({ p }: { p: ProjectItem }) {
  const t = useT()
  const tl = useTL()
  return (
    <GlassCard className="h-full p-7" tilt>
      <div className="gc-z1 mb-4 flex items-center justify-between gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
          style={{ background: 'var(--accent-soft)' }}
          aria-hidden
        >
          {p.emoji}
        </span>
        <StatusBadge status={p.status} />
      </div>

      <h3 className="gc-z2 text-xl font-extrabold">{tl(p.name)}</h3>
      <p className="gc-z3 mt-2.5 flex-1 text-[0.95rem] leading-relaxed text-muted">{tl(p.oneLine)}</p>

      {typeof p.progress === 'number' && (
        <div className="gc-z3 mt-4">
          <div className="flex items-baseline justify-between text-xs font-bold text-muted">
            <span>{t.projects.progress}</span>
            <span className="text-accent">{p.progress}%</span>
          </div>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--line)' }}
            role="progressbar"
            aria-valuenow={p.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${tl(p.name)} ${t.projects.progress}`}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${p.progress}%` }} />
          </div>
        </div>
      )}

      {(p.platform?.length || p.tags?.length) && (
        <div className="gc-z3 mt-4 flex flex-wrap gap-2">
          {p.platform?.map((pl) => (
            <Chip key={pl} strong>
              {pl}
            </Chip>
          ))}
          {p.tags?.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      )}

      {p.note && <p className="gc-z3 mt-3 text-xs leading-relaxed text-muted">{tl(p.note)}</p>}

      {(p.links?.repo || p.links?.site) && (
        <div className="gc-z2 mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {p.links?.repo && (
            <a
              href={p.links.repo}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-extrabold text-accent hover:underline"
            >
              {t.projects.repo} <ArrowUpRight className="ar-pop h-3.5 w-3.5" />
            </a>
          )}
          {p.links?.site && (
            <a
              href={p.links.site}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-extrabold text-accent hover:underline"
            >
              {t.projects.site} <ArrowUpRight className="ar-pop h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </GlassCard>
  )
}

/**
 * 占位卡（仅 PC 端渲染）：与项目卡同款玻璃卡骨架，表面覆磨砂层（.frost-layer），
 * hover 时磨砂渐隐露出玻璃本色。不参与 tilt、关闭光斑，视觉不抢戏。
 */
function PlaceholderCard() {
  const t = useT()
  return (
    <GlassCard className="placeholder-card h-full p-7">
      <span className="frost-layer" aria-hidden />
      <div className="gc-z1 mb-4 flex items-center justify-between gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl opacity-60"
          style={{ background: 'var(--accent-soft)' }}
          aria-hidden
        >
          🫥
        </span>
      </div>
      <h3 className="gc-z2 text-xl font-extrabold text-muted">{t.projects.placeholderTitle}</h3>
      <p className="gc-z3 mt-2.5 flex-1 text-[0.95rem] leading-relaxed text-muted">
        {t.projects.placeholderText}
      </p>
    </GlassCard>
  )
}

/**
 * 项目（01）：按状态分段展示，不再自动拉取 GitHub 全部仓库
 * 头部右侧是「全部 N 个仓库在 GitHub」外链 —— 有右侧元素，故整体左对齐
 */
export default function Projects({ repoCount }: { repoCount: number }) {
  const t = useT()
  return (
    <section id="projects" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-9 flex items-baseline justify-between gap-4">
            <h2 className="text-3xl font-black">
              <span className="mr-3 text-base font-bold text-accent">{t.projects.num}</span>
              {t.projects.title}
            </h2>
            <a
              href="https://github.com/YAHU2024?tab=repositories"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-sm font-bold text-muted transition-colors hover:text-foreground"
            >
              {t.projects.allOnGitHub(repoCount)} <span className="ar-pop">→</span>
            </a>
          </div>
        </Reveal>

        {statusOrder.map((status) => {
          const list = projects.filter((p) => p.status === status)
          if (!list.length) return null
          const label = t.projects.status[status]
          return (
            <div key={status} className="mt-10 first:mt-0">
              <Reveal>
                <div
                  className="mb-5 flex items-center gap-3"
                  aria-label={t.projects.groupAria(label, list.length)}
                >
                  <h3 className="text-lg font-extrabold">{label}</h3>
                  <span className="text-sm font-bold text-accent">{list.length}</span>
                  <span className="h-px flex-1" style={{ background: 'var(--line)' }} aria-hidden />
                </div>
              </Reveal>
              <div className="grid gap-5 md:grid-cols-2">
                {list.map((p, i) => (
                  <Reveal key={p.name.zh} delay={i * 80}>
                    <ProjectCard p={p} />
                  </Reveal>
                ))}
                {/* PC 端补位：每组右侧放一张占位卡；移动端单列不渲染 */}
                <Reveal delay={list.length * 80} className="hidden md:block">
                  <div aria-hidden="true" className="h-full">
                    <PlaceholderCard />
                  </div>
                </Reveal>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
