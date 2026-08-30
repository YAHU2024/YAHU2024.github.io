import Reveal from '@/components/Reveal'

export default function About() {
  return (
    <section id="about" className="layer-content px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center text-3xl font-black">
            <span className="mr-3 text-base font-bold text-accent">04</span>关于我
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-8 space-y-4 text-center text-lg leading-relaxed text-muted">
            <p>
              我是 <b className="font-extrabold text-foreground">YAHU</b>
              ，喜欢把日常里的小麻烦做成
              <b className="font-extrabold text-accent">顺手的软件</b>
              。信奉 vibe coding：先让它跑起来，再把它打磨好。
            </p>
            <p>
              比起"大而全"，我更享受把一个小工具做到顺手的过程。最近主要在折腾
              <b className="font-extrabold text-foreground"> AI 桌面应用</b>和
              <b className="font-extrabold text-foreground">知识流水线</b>。
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
