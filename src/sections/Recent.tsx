import { now } from '@/data/now'
import { copy } from '@/data/copy'
import GlassCard from '@/components/GlassCard'

const { recentPage } = copy

/** '2026-09-04' → '2026.09.04'（sandev 式日期点分格式） */
function dotDate(iso: string): string {
  return iso.replaceAll('-', '.')
}

/**
 * 「最近」页左半屏内容（无 section 外壳，由 Home 统一排版，右半屏共用猫徽章）：
 * - 大标题 + 一句话说明
 * - 动态：玻璃卡日期流（数据源 now.timeline）
 * - 计划：编号玻璃卡（代号 / 标题 / 描述 / 进度条 / 状态标签，数据源 now.plans）
 * - 带 data-tz 标记的块参与视图切换的模糊渐变转场
 */
export default function RecentLeft() {
  return (
    <div>
      <div data-tz>
        <h1 className="text-[2.3rem] font-black leading-[1.25] tracking-wide md:text-5xl">
          {recentPage.title.slice(0, -1)}
          <span className="text-accent">。</span>
        </h1>
        <p className="mt-4 text-lg text-muted">{recentPage.desc}</p>
      </div>

      {/* 动态：日期流玻璃卡 */}
      <h2 className="mt-10 flex items-center gap-3 text-lg font-extrabold" data-tz>
        {recentPage.notesTitle}
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} aria-hidden />
      </h2>
      <div className="mt-5 space-y-4">
        {now.timeline.map((t) => (
          <GlassCard key={t.date} className="p-6" data-tz>
            <time className="text-xs font-bold text-accent" dateTime={t.date}>
              {dotDate(t.date)}
            </time>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{t.text}</p>
          </GlassCard>
        ))}
      </div>

      {/* 计划：编号玻璃卡 */}
      <h2 className="mt-10 flex items-center gap-3 text-lg font-extrabold" data-tz>
        {recentPage.plansTitle}
        <span className="h-px flex-1" style={{ background: 'var(--line)' }} aria-hidden />
      </h2>
      <div className="mt-5 space-y-4">
        {now.plans.map((plan, i) => (
          <GlassCard key={plan.tag} className="p-6" data-tz>
            <div className="flex items-center gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-accent"
                style={{ background: 'var(--accent-soft)' }}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="font-mono text-xs font-bold tracking-widest text-muted">
                {plan.tag}
              </span>
              <span
                className="ml-auto shrink-0 rounded-full border px-3 py-0.5 text-xs font-bold text-muted"
                style={{ borderColor: 'var(--gborder)' }}
              >
                {plan.status}
              </span>
            </div>
            <h3 className="mt-3 text-base font-extrabold">{plan.title}</h3>
            {plan.desc && (
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">{plan.desc}</p>
            )}
            {typeof plan.progress === 'number' && (
              <div className="mt-4">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--line)' }}
                  role="progressbar"
                  aria-valuenow={plan.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${plan.title} ${copy.projects.progress}`}
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${plan.progress}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs font-bold text-accent">
                  {plan.progress}%
                </div>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
