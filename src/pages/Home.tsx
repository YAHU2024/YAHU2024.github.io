import Nav from '@/sections/Nav'
import Hero from '@/sections/Hero'
import Featured from '@/sections/Featured'
import AllRepos from '@/sections/AllRepos'
import Toolbox from '@/sections/Toolbox'
import About from '@/sections/About'
import Footer from '@/sections/Footer'
import ScrollProgress from '@/components/ScrollProgress'
import { useGitHub } from '@/hooks/useGitHub'

export default function Home() {
  const { repos, followers, publicRepos, live } = useGitHub()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 背景光斑：深色=极光 / 浅色=马卡龙 */}
      <div className="blob blob-1" aria-hidden />
      <div className="blob blob-2" aria-hidden />
      <div className="blob blob-3" aria-hidden />

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
