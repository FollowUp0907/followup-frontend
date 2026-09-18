import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react'
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

/**
 * autoGrow 를 켜면 입력한 만큼 칸이 늘어난다.
 *
 * 높이를 재기 전에 auto 로 한 번 되돌려야 한다. 안 그러면 scrollHeight 가
 * 지금 높이에 갇혀서 글을 지워도 줄어들지 않는다.
 * value 가 밖에서 바뀌는 경우(받아쓰기 등)도 있어 레이아웃 시점마다 다시 잰다.
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; autoGrow?: boolean }
>(function Textarea({ className, invalid, autoGrow, onChange, value, style, ...rest }, ref) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  const fit = useCallback(() => {
    const el = innerRef.current
    if (!el || !autoGrow) return
    el.style.height = 'auto'
    // max-height 가 걸려 있으면 거기까지만 자라고, 그 뒤부터는 안에서 스크롤한다.
    const max = Number.parseFloat(getComputedStyle(el).maxHeight)
    const capped = Number.isFinite(max) && el.scrollHeight > max
    el.style.height = `${capped ? max : el.scrollHeight}px`
    el.style.overflowY = capped ? 'auto' : 'hidden'
  }, [autoGrow])

  // 값이 바뀔 때는 물론, 밖에서 max-height 가 바뀌어도 다시 재야 한다.
  useLayoutEffect(fit, [fit, value, style?.maxHeight])

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      value={value}
      style={style}
      onChange={(e) => {
        onChange?.(e)
        fit()
      }}
      className={cn(
        CONTROL,
        // cn 은 단순 join 이라 같은 속성을 두 번 주면 어느 쪽이 이길지 알 수 없다.
        // 호출부가 min-h 를 정했으면 기본값을 아예 넣지 않는다.
        !className?.includes('min-h-') && 'min-h-[160px]',
        'px-sm py-sm leading-relaxed',
        // 자동으로 늘어나면 사용자가 크기를 끌 이유가 없다.
        // (overflow 는 fit() 이 내용 길이를 보고 직접 켜고 끈다)
        autoGrow ? 'thin-scroll resize-none' : 'resize-y',
        invalid && 'border-error',
        className,
      )}
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
          "h-10 appearance-none bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath d='M5.5 7.5L10 12l4.5-4.5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat pl-sm pr-xl",
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
