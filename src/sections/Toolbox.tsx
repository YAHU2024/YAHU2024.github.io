import { toolbox } from '@/data/github'
import { useT, useTL } from '@/hooks/useLocale'
import Reveal from '@/components/Reveal'
import GlassCard from '@/components/GlassCard'

export default function Toolbox() {
  const t = useT()
  const tl = useTL()
  return (
    <section id="toolbox" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-9 text-center">
            <h2 className="text-3xl font-black">
              <span className="mr-3 text-base font-bold text-accent">{t.toolbox.num}</span>
              {t.toolbox.title}
            </h2>
            <p className="mt-2 text-sm text-muted">{t.toolbox.subtitle}</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {toolbox.map((tool, i) => (
            <Reveal key={tool.name.zh} delay={i * 60}>
              <GlassCard
                className="h-full px-4 py-6"
                innerClassName="flex flex-1 flex-col items-center text-center"
              >
                <span className="tool-emoji text-3xl">{tool.emoji}</span>
                <span className="mt-3 text-sm font-extrabold">{tl(tool.name)}</span>
                <span className="mt-1 text-xs text-muted">{tl(tool.use)}</span>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
