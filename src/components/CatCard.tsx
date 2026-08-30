import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { catPhrases, profile } from '@/data/github'
import { useTheme } from '@/hooks/useTheme'

/** 气泡轮播消息：真实状态优先，猫语穿插 */
const messages = [profile.nowStatus, ...catPhrases]

/**
 * Hero 右侧的互动猫卡：
 * - 视差倾斜 + 头像"眼神跟随"（桌面端；触屏/减弱动效自动关闭）
 * - 闲时/悬停弹出气泡，轮播 真实状态 + 猫语，点击立即换一句
 * - 昼夜联动：切深色猫咪打瞌睡冒 Zzz，切浅色秒醒抖毛撒星星
 */
export default function CatCard() {
  const [theme] = useTheme()
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const avaRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const msgIndex = useRef(0)
  const animating = useRef(false)

  // ── 气泡轮播 ──
  useEffect(() => {
    const bubble = bubbleRef.current
    if (!bubble) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const show = (text: string) => {
      bubble.textContent = text
      if (reduced) {
        gsap.set(bubble, { opacity: 1, y: 0, scale: 1 })
        return
      }
      gsap.fromTo(
        bubble,
        { opacity: 0, y: 8, scale: 0.7 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' },
      )
    }
    const rotate = () => {
      if (animating.current) return
      animating.current = true
      msgIndex.current = (msgIndex.current + 1) % messages.length
      const swap = () => show(messages[msgIndex.current])
      if (reduced) {
        swap()
      } else {
        gsap.to(bubble, {
          opacity: 0,
          y: 6,
          scale: 0.8,
          duration: 0.25,
          ease: 'power1.in',
          onComplete: swap,
        })
      }
      animating.current = false
    }

    const first = window.setTimeout(() => show(messages[0]), 1300)
    const timer = window.setInterval(rotate, 7000)
    const stage = stageRef.current
    const onEnter = () => {
      if (bubble.style.opacity === '0' || !bubble.style.opacity) show(messages[msgIndex.current])
    }
    stage?.addEventListener('mouseenter', onEnter)

    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      stage?.removeEventListener('mouseenter', onEnter)
    }
  }, [])

  // ── 视差倾斜 + 悬浮呼吸（触屏/减弱动效关闭） ──
  useEffect(() => {
    const stage = stageRef.current
    const card = cardRef.current
    const ava = avaRef.current
    if (!stage || !card || !ava) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(hover: none)').matches
    if (reduced || coarse) return

    const ctx = gsap.context(() => {
      // 待机呼吸
      gsap.to(card, { y: -7, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' })

      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2.out' })
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2.out' })
      const ax = gsap.quickTo(ava, 'x', { duration: 0.6, ease: 'power2.out' })
      const ay = gsap.quickTo(ava, 'y', { duration: 0.6, ease: 'power2.out' })
      const decos = gsap.utils.toArray<HTMLElement>('[data-depth]', stage)
      const decoTo = decos.map((d) => ({
        depth: Number(d.dataset.depth ?? 1),
        x: gsap.quickTo(d, 'x', { duration: 0.6, ease: 'power2.out' }),
        y: gsap.quickTo(d, 'y', { duration: 0.6, ease: 'power2.out' }),
      }))

      gsap.set(card, { transformPerspective: 800, transformOrigin: 'center' })

      const onMove = (e: MouseEvent) => {
        const rect = stage.getBoundingClientRect()
        const px = (e.clientX - rect.left) / rect.width - 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5
        rx(py * -10)
        ry(px * 12)
        // 头像朝鼠标方向偏一点 → "看向你"
        ax(px * 10)
        ay(py * 8)
        decoTo.forEach(({ depth, x, y }) => {
          x(px * depth * 26)
          y(py * depth * 20)
        })
      }
      const onLeave = () => {
        gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' })
        gsap.to([ava, ...decos], { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' })
      }
      stage.addEventListener('mousemove', onMove)
      stage.addEventListener('mouseleave', onLeave)
      return () => {
        stage.removeEventListener('mousemove', onMove)
        stage.removeEventListener('mouseleave', onLeave)
      }
    }, stage)
    return () => ctx.revert()
  }, [])

  // ── 昼夜联动：深色打瞌睡冒 Zzz；切回浅色秒醒抖毛撒星星 ──
  const prevTheme = useRef(theme)
  useEffect(() => {
    const ava = avaRef.current
    if (!ava) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wasDark = prevTheme.current === 'dark'
    prevTheme.current = theme

    // 初次挂载：深色主题下直接呈现睡眠状态（不做切换动画）
    if (theme === 'dark') {
      const z = ava.querySelectorAll<HTMLElement>('.zzz-letter')
      if (!reduced && wasDark) {
        // 从浅色切到深色 → 入睡动画
        z.forEach((letter, i) => {
          gsap.fromTo(
            letter,
            { y: 8, opacity: 0, scale: 0.5 },
            {
              keyframes: [
                { y: -12, opacity: 0.95, scale: 1, duration: 0.9 },
                { y: -30, opacity: 0, scale: 0.9, duration: 1 },
              ],
              delay: i * 0.7,
              repeat: -1,
              repeatDelay: 0.8,
              ease: 'none',
            },
          )
        })
      } else {
        gsap.set(z, { opacity: 0 })
      }
      return
    }

    // 浅色主题：清掉 Zzz（动画与透明度都复位）；若刚从深色醒来，抖毛 + 撒星星
    const z = ava.querySelectorAll<HTMLElement>('.zzz-letter')
    gsap.killTweensOf(z)
    gsap.set(z, { opacity: 0 })
    if (!wasDark) return
    if (reduced) return

    gsap.to(ava, {
      keyframes: [
        { x: -5, duration: 0.07 },
        { x: 5, duration: 0.07 },
        { x: -3, duration: 0.07 },
        { x: 3, duration: 0.07 },
        { x: 0, duration: 0.07 },
      ],
    })
    const colors = ['✨', '⭐', '✨', '💫', '⭐', '✨']
    colors.forEach((ch, i) => {
      const star = document.createElement('span')
      star.className = 'wake-star'
      star.textContent = ch
      star.style.left = `${14 + i * 12}%`
      star.style.top = `${8 + (i % 3) * 14}%`
      star.style.fontSize = `${12 + (i % 3) * 5}px`
      ava.appendChild(star)
      gsap.fromTo(
        star,
        { scale: 0, opacity: 1, rotation: 0 },
        {
          scale: 1.25,
          opacity: 0,
          rotation: 40,
          y: -26,
          duration: 0.9,
          delay: i * 0.06,
          ease: 'power1.out',
          onComplete: () => star.remove(),
        },
      )
    })
  }, [theme])

  const sleeping = theme === 'dark'

  return (
    <div ref={stageRef} className="relative mx-auto w-full max-w-sm select-none">
      {/* 漂浮装饰（不同深度，跟随鼠标视差） */}
      <span data-depth="1.4" className="floaty pointer-events-none absolute left-1 top-3 text-2xl">
        ⭐
      </span>
      <span data-depth="0.8" className="floaty-d pointer-events-none absolute right-3 top-16 text-xl">
        🐟
      </span>
      <span data-depth="1.1" className="floaty pointer-events-none absolute bottom-3 left-6 text-lg">
        ✨
      </span>

      <div
        ref={cardRef}
        onClick={() => {
          msgIndex.current = (msgIndex.current + 1) % messages.length
          const bubble = bubbleRef.current
          if (bubble) {
            bubble.textContent = messages[msgIndex.current]
            gsap.fromTo(
              bubble,
              { opacity: 0, y: 8, scale: 0.7 },
              { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(2)' },
            )
          }
        }}
        className="glass cursor-pointer rounded-3xl p-7 will-change-transform"
      >
        {/* 气泡 */}
        <div
          ref={bubbleRef}
          className="glass relative mb-5 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm font-medium text-foreground opacity-0"
          style={{ opacity: 0 }}
        >
          {messages[0]}
        </div>

        {/* 头像 + 昼夜状态 */}
        <div ref={avaRef} className="relative mx-auto h-36 w-36 will-change-transform">
          <div
            className="relative h-full w-full overflow-hidden rounded-full border-2"
            style={{
              borderColor: 'var(--accent)',
              filter: sleeping ? 'var(--cat-dim)' : 'none',
              transition: 'filter 0.6s ease',
            }}
          >
            <span className="absolute inset-0 flex items-center justify-center bg-white text-5xl">
              🐱
            </span>
            <img
              src={profile.avatarUrl}
              alt="YAHU 的猫头像"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => e.currentTarget.remove()}
            />
          </div>
          {/* 打瞌睡 Zzz */}
          <span className="zzz-letter right-2 top-0 text-lg">z</span>
          <span className="zzz-letter right-5 top-1 text-xl">Z</span>
          <span className="zzz-letter right-8 top-2 text-base">z</span>
        </div>

        <div className="mt-5 text-center">
          <div className="text-lg font-extrabold tracking-wide">YAHU</div>
          <div className="mt-0.5 text-sm text-muted">
            工具构建者 · {sleeping ? '打瞌睡中…' : 'vibe coder'}
          </div>
        </div>
      </div>
    </div>
  )
}
