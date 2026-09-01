import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ArrowDown, Github } from 'lucide-react'
import { profile, snapshot } from '@/data/github'
import { copy } from '@/data/copy'
import CatCard from '@/components/CatCard'
import CountUp from '@/components/CountUp'
import Reveal from '@/components/Reveal'

interface HeroProps {
  publicRepos: number
  repos: { updatedAt: string | null }[]
}

function latestUpdatedDays(repos: { updatedAt: string | null }[]): number | null {
  const latest = repos
    .map((r) => r.updatedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)
  if (!latest) return null
  return Math.max(0, Math.floor((Date.now() - new Date(latest).getTime()) / 86_400_000))
}

/** 人性化的相对时间：0→今天、1→昨天、一周内→N 天前、一月内→N 周前、更久→N 个月前 */
function formatLatestUpdated(days: number | null): string {
  const { timeAgo } = copy.hero
  if (days === null) return timeAgo.none
  if (days === 0) return timeAgo.today
  if (days === 1) return timeAgo.yesterday
  if (days < 7) return timeAgo.days(days)
  if (days < 30) return timeAgo.weeks(Math.floor(days / 7))
  return timeAgo.months(Math.floor(days / 30))
}

export default function Hero({ publicRepos, repos }: HeroProps) {
  const line1Ref = useRef<HTMLSpanElement>(null)
  const line2Ref = useRef<HTMLSpanElement>(null)
  const days = latestUpdatedDays(repos)

  // 入场：标题两行轻量上浮（Reduced-motion 下直接呈现最终态）
  useEffect(() => {
    const els = [line1Ref.current, line2Ref.current].filter(
      (el): el is HTMLSpanElement => Boolean(el),
    )
    if (!els.length) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // fromTo 显式声明起止，StrictMode 双挂载下也不会停在透明态
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' },
    )
    return () => {
      tween.kill()
      gsap.set(els, { clearProps: 'opacity,transform' })
    }
  }, [])

  return (
    <section id="top" className="layer-content px-6 pb-16 pt-14 md:pb-24 md:pt-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
        {/* 左：低密度信息栏 */}
        <div>
          <Reveal>
            <span className="glass inline-block rounded-full px-4 py-1.5 text-sm font-bold">
              {copy.hero.hello}
            </span>
          </Reveal>
          <h1 className="mt-6 text-[2.3rem] font-black leading-[1.25] tracking-wide md:text-5xl">
            <span ref={line1Ref} className="block">
              {profile.headline.line1}
            </span>
            <span ref={line2Ref} className="block">
              {profile.headline.line2Pre}
              <span className="text-accent" style={{ textShadow: 'var(--accent-glow)' }}>
                {profile.headline.accent}
              </span>
              {profile.headline.line2Post}
            </span>
          </h1>
          <Reveal delay={120}>
            <p className="mt-5 text-lg text-muted">
              <b className="font-bold text-foreground">{profile.tagline}</b>
              <br />
              {profile.subtitle}
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-wrap items-center">
              <div className="py-1 pr-7">
                <CountUp value={publicRepos} className="text-2xl font-extrabold" />
                <div className="mt-0.5 text-xs font-semibold text-muted">{copy.hero.statRepos}</div>
              </div>
              <div className="border-l py-1 pl-7 pr-7" style={{ borderColor: 'var(--line)' }}>
                <CountUp
                  value={snapshot.contributionsLastYear}
                  className="text-2xl font-extrabold"
                />
                <div className="mt-0.5 text-xs font-semibold text-muted">{copy.hero.statCommits}</div>
              </div>
              <div className="border-l py-1 pl-7" style={{ borderColor: 'var(--line)' }}>
                <div className="text-2xl font-extrabold">{formatLatestUpdated(days)}</div>
                <div className="mt-0.5 text-xs font-semibold text-muted">{copy.hero.statUpdated}</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={280}>
            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#featured"
                className="btn-pop rounded-xl bg-accent px-6 py-3 font-bold text-[var(--accent-ink)]"
                style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}
              >
                {copy.hero.ctaProjects} <ArrowDown className="ml-1 inline h-4 w-4" />
              </a>
              <a
                href={profile.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-pop glass flex items-center gap-2 rounded-xl px-6 py-3 font-bold"
              >
                <Github className="h-4 w-4" /> {copy.hero.github}
              </a>
            </div>
          </Reveal>
        </div>

        {/* 右：互动猫卡 */}
        <Reveal delay={150}>
          <CatCard />
        </Reveal>
      </div>
    </section>
  )
}
