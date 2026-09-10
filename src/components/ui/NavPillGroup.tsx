import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

export interface PillItem {
  to: string
  label: string
  end?: boolean
}

/** Cal.com 시그니처 컴포넌트 — pill 안의 pill */
export function NavPillGroup({ items, className }: { items: PillItem[]; className?: string }) {
  return (
    <nav
      className={cn(
        'thin-scroll inline-flex max-w-full gap-xxs overflow-x-auto rounded-pill bg-surface-soft p-[6px]',
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
              'whitespace-nowrap rounded-md px-[14px] py-xs text-nav-link transition-colors',
              isActive ? 'bg-canvas text-ink shadow-pill' : 'text-muted',
            )
          }
        >
          {item.label}
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
