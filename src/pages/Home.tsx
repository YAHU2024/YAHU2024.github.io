import { useMemo } from 'react'
import Nav from '@/sections/Nav'
import Hero from '@/sections/Hero'
import Featured from '@/sections/Featured'
import AllRepos from '@/sections/AllRepos'
import Toolbox from '@/sections/Toolbox'
import About from '@/sections/About'
import Footer from '@/sections/Footer'
import ScrollProgress from '@/components/ScrollProgress'
import { useGitHub } from '@/hooks/useGitHub'
import { useScrollParallax } from '@/hooks/useScrollParallax'

/** 尘埃粒子的确定性伪随机配置（负 delay 让页面打开时已在半空） */
function useDust() {
  return useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        left: `${(i * 11 + 5) % 96}%`,
        size: 2 + ((i * 7) % 3),
        duration: 16 + ((i * 5) % 14),
        delay: -i * 3.7,
        sway: i % 2 ? 42 : -36,
      })),
    [],
  )
}

export default function Home() {
  const { repos, followers, publicRepos, live } = useGitHub()
  useScrollParallax()
  const dust = useDust()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 背景极光场：光斑游动 + 滚动视差（深色=极光 / 浅色=马卡龙） */}
      <div className="blob-par" data-parallax="-0.045" aria-hidden>
        <div className="blob blob-1" />
      </div>
      <div className="blob-par" data-parallax="-0.07" aria-hidden>
        <div className="blob blob-2" />
      </div>
      <div className="blob-par" data-parallax="-0.1" aria-hidden>
        <div className="blob blob-3" />
      </div>
      <div className="blob-par" data-parallax="-0.06" aria-hidden>
        <div className="blob blob-4" />
      </div>

      {/* 上升微光尘埃 */}
      <div className="dust" aria-hidden>
        {dust.map((d, i) => (
          <i
            key={i}
            style={
              {
                left: d.left,
                width: d.size,
                height: d.size,
                animationDuration: `${d.duration}s`,
                animationDelay: `${d.delay}s`,
                '--sway': `${d.sway}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <ScrollProgress />
      <Nav />
      <main>
        <Hero publicRepos={publicRepos} repos={repos} />
        <Featured />
        <AllRepos repos={repos} />
        <Toolbox />
        <About />
      </main>
      <Footer live={live} />
      {/* followers 目前未上界面，保留引用避免 hook 字段悬空 */}
      <span className="hidden">{followers}</span>
    </div>
  )
}
