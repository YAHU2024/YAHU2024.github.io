import { parseRichText } from '@/lib/richText'
import { useT } from '@/hooks/useLocale'
import Reveal from '@/components/Reveal'

/** 强调样式：strong 用前景色，accent 用站点强调色 */
const KIND_CLASS: Record<'strong' | 'accent', string> = {
  strong: 'font-extrabold text-foreground',
  accent: 'font-extrabold text-accent',
}

export default function About() {
  const t = useT()
  const tokens = parseRichText(t.about.text)

  return (
    <section id="about" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center text-3xl font-black">
            <span className="mr-3 text-base font-bold text-accent">{t.about.num}</span>
            {t.about.title}
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-8 text-center text-lg leading-relaxed text-muted">
            {tokens.map((tok, i) =>
              tok.kind ? (
                <b key={i} className={KIND_CLASS[tok.kind]}>
                  {tok.text}
                </b>
              ) : (
                <span key={i}>{tok.text}</span>
              ),
            )}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
