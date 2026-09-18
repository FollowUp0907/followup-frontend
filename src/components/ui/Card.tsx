import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 회색 카드 = 추상적인 정보 블록 */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-lg bg-surface-card p-xl', className)}>{children}</div>
}

/** 흰 카드 + 헤어라인 = 실제 제품 데이터를 보여주는 자리 */
export function SurfaceCard({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return <Tag className={cn('rounded-lg border border-hairline bg-canvas shadow-soft', className)}>{children}</Tag>
}

export function SectionTitle({
  title,
  description,
  action,
  className,
  icon,
  iconColor,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** 섹션을 구분해 주는 작은 색 아이콘 (DESIGN.md 의 "small accent moments") */
  icon?: ReactNode
  iconColor?: string
}) {
  return (
    <div className={cn('mb-lg flex flex-wrap items-end justify-between gap-md', className)}>
      <div>
        <h2 className="flex items-center gap-xs text-title-lg text-ink">
          {icon && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-sm"
              style={iconColor ? { background: `${iconColor}1f`, color: iconColor } : undefined}
              aria-hidden
            >
              {icon}
            </span>
          )}
          {title}
        </h2>
        {description && <p className="mt-xxs text-body-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-hairline bg-surface-soft px-lg py-xxl text-center',
        className,
      )}
    >
      <p className="text-title-sm text-ink">{title}</p>
      {description && <p className="mx-auto mt-xs max-w-md text-body-sm text-muted">{description}</p>}
      {action && <div className="mt-lg flex justify-center">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-card', className)} />
}
