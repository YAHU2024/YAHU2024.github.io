import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ArrowDown, Github } from 'lucide-react'
import { profile } from '@/data/github'
import Reveal from '@/components/Reveal'
import CountUp from '@/components/CountUp'
import Magnetic from '@/components/Magnetic'

gsap.registerPlugin(SplitText)

interface HeroProps {
  followers: number
  publicRepos: number
  live: boolean
}

export default function Hero({ followers, publicRepos, live }: HeroProps) {
  const headlineRef = useRef<HTMLHeadingElement>(null)

  // B1: 字符级拆分入场动画（expo.out），reduced-motion 下直接呈现最终态
  useEffect(() => {
    const el = headlineRef.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const split = new SplitText(el.querySelectorAll('.headline-line'), { type: 'chars' })
      gsap.from(split.chars, {
        opacity: 0,
        y: 20,
        rotateX: -40,
        duration: 0.6,
        stagger: 0.015,
        ease: 'expo.out',
      })
      return () => split.revert()
    })
    return () => mm.revert()
  }, [])

  const stats: { label: string; value: number }[] = [
    { label: '公开仓库', value: publicRepos },
    { label: '近一年贡献', value: profile.contributionsLastYear },
    { label: '关注者', value: followers },
    { label: '加入 GitHub', value: Number(profile.createdAt.slice(0, 4)) },
  ]

  return (
    <section id="top" className="bg-blueprint border-b pt-14">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-16 md:pb-24 md:pt-24">
        <Reveal>
          <div className="mb-8 flex items-center gap-4">
            <img
              src={profile.avatarUrl}
              alt={`${profile.login} 的头像`}
              className="h-14 w-14 border"
            />
            <div className="font-mono text-xs tracking-widest text-muted-foreground">
              <div>@{profile.login}</div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 ${live ? 'bg-green-500' : 'bg-yellow-500'}`}
                />
                {live ? 'LIVE · GITHUB API' : 'SNAPSHOT · OFFLINE'}
              </div>
            </div>
          </div>
        </Reveal>

        <h1
          ref={headlineRef}
          className="font-display text-[13vw] font-bold leading-[0.95] tracking-tight md:text-8xl"
        >
          {profile.headline.map((line, i) => (
            <span
              key={line + i}
              className={`headline-line block ${i % 2 === 1 ? 'text-outline' : ''}`}
            >
              {line}
            </span>
          ))}
        </h1>

        <Reveal delay={150}>
          <div className="mt-10 max-w-2xl border-l-2 border-accent pl-6">
            <p className="text-lg font-medium leading-relaxed md:text-xl">{profile.tagline}</p>
            <p className="mt-3 font-mono text-sm text-muted-foreground">{profile.subtitle}</p>
          </div>
        </Reveal>

        <Reveal delay={250}>
          <div className="mt-10 flex flex-wrap gap-4">
            <Magnetic>
              <a
                href="#pinned"
                className="flex items-center gap-2 border bg-foreground px-6 py-3 font-mono text-sm font-semibold text-background"
              >
                查看项目 <ArrowDown className="h-4 w-4" />
              </a>
            </Magnetic>
            <Magnetic>
              <a
                href={profile.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 border px-6 py-3 font-mono text-sm transition-colors hover:border-accent hover:text-accent"
              >
                <Github className="h-4 w-4" /> GITHUB
              </a>
            </Magnetic>
          </div>
        </Reveal>
      </div>

      <div className="border-t">
        <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-6 py-6 ${i > 0 ? 'border-l' : ''} ${i >= 2 ? 'max-md:border-t max-md:border-l-0' : ''} ${i === 3 ? 'max-md:border-l' : ''}`}
            >
              <div className="font-display text-3xl font-bold md:text-4xl">
                <CountUp value={s.value} duration={1000 + i * 150} />
              </div>
              <div className="mt-1 font-mono text-xs tracking-widest text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
