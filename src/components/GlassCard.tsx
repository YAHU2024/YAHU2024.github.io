import { useRef, type HTMLAttributes, type ReactNode } from 'react'
import { useTilt } from '@/hooks/useTilt'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** 外层附加类：尺寸 / 布局 / 间距 / 圆角覆盖 */
  className?: string
  /** 内层附加类：内容 flex 布局（默认纵向撑满） */
  innerClassName?: string
  /** 启用 3D 微倾斜（默认关；密集网格不建议全开） */
  tilt?: boolean
  /** 最大倾角（度），默认 6 */
  maxTilt?: number
}

/**
 * 玻璃卡片（灵动交互版）：
 * - 外层 .glass-card：磨砂玻璃视觉 + hover 弹性浮起 + 按压压感
 * - 内层 .glass-card-in：3D 倾斜（JS 驱动）+ 内容深度分层（gc-z1/z2/z3）
 * - 运动期自动关 backdrop-filter
 */
export default function GlassCard({
  children,
  className = '',
  innerClassName = 'flex flex-1 flex-col',
  tilt = false,
  maxTilt = 6,
  ...rest
}: GlassCardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useTilt({ root: rootRef, target: innerRef }, { enabled: tilt, maxTilt })

  return (
    <div ref={rootRef} className={`glass-card glass ${className}`} {...rest}>
      <div ref={innerRef} className={`glass-card-in ${innerClassName}`}>
        {children}
      </div>
    </div>
  )
}
