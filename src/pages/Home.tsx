import Nav from '@/sections/Nav'
import Hero from '@/sections/Hero'
import Pinned from '@/sections/Pinned'
import Projects from '@/sections/Projects'
import Stack from '@/sections/Stack'
import Footer from '@/sections/Footer'
import { useGitHub } from '@/hooks/useGitHub'

export default function Home() {
  const { repos, followers, publicRepos, live } = useGitHub()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero followers={followers} publicRepos={publicRepos} live={live} />
        <Pinned repos={repos} />
        <Projects repos={repos} />
        <Stack repos={repos} />
      </main>
      <Footer />
    </div>
  )
}
