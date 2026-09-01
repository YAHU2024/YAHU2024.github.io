import { copy } from '@/data/copy'
import Reveal from '@/components/Reveal'

export default function About() {
  return (
    <section id="about" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center text-3xl font-black">
            <span className="mr-3 text-base font-bold text-accent">{copy.about.num}</span>
            {copy.about.title}
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-8 space-y-4 text-center text-lg leading-relaxed text-muted">
            {copy.about.paragraphs.map((p, i) => (
              <p key={i}>
                {p.segments.map((seg, j) => {
                  if ('strong' in seg)
                    return (
                      <b key={j} className="font-extrabold text-foreground">
                        {seg.text}
                      </b>
                    )
                  if ('accent' in seg)
                    return (
                      <b key={j} className="font-extrabold text-accent">
                        {seg.text}
                      </b>
                    )
                  return <span key={j}>{seg.text}</span>
                })}
              </p>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
