import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  // 시스템은 액션 레이어에서 모노크롬 — 기본 CTA 는 near-black
  primary: 'bg-primary text-on-primary active:bg-primary-active disabled:bg-surface-strong disabled:text-muted',
  secondary:
    'bg-canvas text-ink border border-hairline active:bg-surface-card disabled:text-muted disabled:bg-surface-soft',
  ghost: 'bg-transparent text-body active:bg-surface-card disabled:text-muted',
  danger: 'bg-canvas text-error border border-error/30 active:bg-error/5 disabled:text-muted disabled:border-hairline',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-sm text-caption rounded-md',
  md: 'h-10 px-lg text-button rounded-md',
  lg: 'h-12 px-xl text-[15px] font-semibold rounded-md',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children?: ReactNode
  className?: string
}

export type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>

function classes({ variant = 'primary', size = 'md', fullWidth, className }: BaseProps) {
  return cn(
    'inline-flex items-center justify-center gap-xs font-semibold transition-colors select-none',
    'disabled:cursor-not-allowed',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full',
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={classes({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
})

export function ButtonLink({ to, variant, size, fullWidth, className, children }: BaseProps & { to: string }) {
  return (
    <Link to={to} className={classes({ variant, size, fullWidth, className })}>
      {children}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** 36 x 36 원형 아이콘 버튼 */
export function IconButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-pill border border-hairline bg-canvas text-ink',
        'transition-colors active:bg-surface-card disabled:cursor-not-allowed disabled:text-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
