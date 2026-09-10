import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export function Logo({ to = '/', dark = false, className }: { to?: string; dark?: boolean; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-xs', className)}>
      <span
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md',
          dark ? 'bg-canvas' : 'bg-ink',
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3.5 8.5l3 3 6-6"
            stroke={dark ? '#111111' : '#ffffff'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={cn(
          'font-display text-[18px] font-semibold tracking-[-0.5px]',
          dark ? 'text-on-dark' : 'text-ink',
        )}
      >
        FollowUp
      </span>
    </Link>
  )
}
