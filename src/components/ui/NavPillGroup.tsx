import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface PillItem {
  to: string
  label: string
  end?: boolean
  icon?: LucideIcon
}

/** Cal.com 시그니처 컴포넌트 — pill 안의 pill */
export function NavPillGroup({ items, className }: { items: PillItem[]; className?: string }) {
  return (
    <nav
      className={cn(
        // 좁아지면 가로로 밀리지 않게 칸을 줄인다. 아주 좁으면 글자를 접고 아이콘만 남긴다.
        'inline-flex max-w-full gap-xxs overflow-hidden rounded-pill bg-surface-soft p-[4px]',
        className,
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'inline-flex min-w-0 items-center gap-xs whitespace-nowrap rounded-pill px-sm py-xs text-nav-link transition-colors sm:px-[14px]',
              isActive ? 'bg-canvas text-ink shadow-pill' : 'text-muted hover:text-ink',
            )
          }
        >
          {item.icon && <item.icon size={15} className="shrink-0" />}
          <span className={cn(item.icon && 'hidden sm:inline')}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  className?: string
}) {
  return (
    <div className={cn('inline-flex gap-xxs rounded-pill bg-surface-soft p-[6px]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'whitespace-nowrap rounded-md px-[14px] py-xs text-nav-link transition-colors',
            value === o.value ? 'bg-canvas text-ink shadow-pill' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
