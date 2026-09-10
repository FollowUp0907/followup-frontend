import { forwardRef } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded-md border border-hairline bg-canvas text-ink text-body-md placeholder:text-muted-soft ' +
  'transition-colors focus:border-ink focus:outline-none disabled:bg-surface-soft disabled:text-muted'

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-xs block text-caption text-body">
      {children}
      {hint && <span className="ml-xs font-normal text-muted-soft">{hint}</span>}
    </label>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-xs text-caption text-error">{children}</p>
}

export function FormRow({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      <FieldError>{error}</FieldError>
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'h-10 px-sm', invalid && 'border-error', className)} {...rest} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL, 'min-h-[160px] resize-y px-sm py-sm leading-relaxed', invalid && 'border-error', className)}
      {...rest}
    />
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          CONTROL,
          'h-10 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'%236b7280\'%3E%3Cpath d=\'M5.5 7.5L10 12l4.5-4.5\' stroke=\'%236b7280\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E")] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat pl-sm pr-xl',
          invalid && 'border-error',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    )
  },
)
