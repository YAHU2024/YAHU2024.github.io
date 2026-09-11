import { copy } from '@/data/copy'
import { parseRichText } from '@/lib/richText'
import Reveal from '@/components/Reveal'

/** 强调样式：strong 用前景色，accent 用站点强调色 */
const KIND_CLASS: Record<'strong' | 'accent', string> = {
  strong: 'font-extrabold text-foreground',
  accent: 'font-extrabold text-accent',
}

export default function About() {
  const tokens = parseRichText(copy.about.text)

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
          <p className="mt-8 text-center text-lg leading-relaxed text-muted">
            {tokens.map((t, i) =>
              t.kind ? (
                <b key={i} className={KIND_CLASS[t.kind]}>
                  {t.text}
                </b>
              ) : (
                <span key={i}>{t.text}</span>
              ),
            )}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
