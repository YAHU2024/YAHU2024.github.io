import { useLocale, useT } from '@/hooks/useLocale'

/** 中英语言开关：样式对齐 ThemeToggle；钮面显示目标语言（中文态显示 EN，英文态显示 中） */
export default function LangToggle() {
  const [locale, setLocale] = useLocale()
  const t = useT()
  const next = locale === 'zh' ? 'en' : 'zh'

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={t.lang.toggleAria}
      title={t.lang.toggleTitle}
      className="glass flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full px-2 text-xs font-extrabold tracking-wide text-foreground/80 transition-transform hover:scale-110 hover:text-foreground active:scale-95"
    >
      {next === 'en' ? 'EN' : '中'}
    </button>
  )
}
