import { toolbox } from '@/data/github'
import Reveal from '@/components/Reveal'
import GlassCard from '@/components/GlassCard'

export default function Toolbox() {
  return (
    <section id="toolbox" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-9 text-center">
            <h2 className="text-3xl font-black">
              <span className="mr-3 text-base font-bold text-accent">03</span>工具箱
            </h2>
            <p className="mt-2 text-sm text-muted">常用的一些家伙事儿</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {toolbox.map((t, i) => (
            <Reveal key={t.name} delay={i * 60}>
              <GlassCard
                className="h-full px-4 py-6"
                innerClassName="flex flex-1 flex-col items-center text-center"
              >
                <span className="tool-emoji text-3xl">{t.emoji}</span>
                <span className="mt-3 text-sm font-extrabold">{t.name}</span>
                <span className="mt-1 text-xs text-muted">{t.use}</span>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
