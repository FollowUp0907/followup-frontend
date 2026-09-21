import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useAnchoredPanel } from './useAnchoredPanel'

export interface MultiOption {
  value: number
  label: string
  adornment?: ReactNode
  description?: string
}

/**
 * 여러 개를 고르는 드롭다운. 항목마다 체크박스가 붙는다.
 *
 * 생김새·동작은 단일 Dropdown 과 같게 맞췄다 (트리거 h-40, 패널은 body 로 포털).
 * 다른 점은 **고르면 닫히지 않는다**는 것 — 여러 명을 연달아 체크해야 해서다.
 * 닫기는 바깥 클릭 · Esc · 트리거 다시 누르기.
 */
export function MultiDropdown({
  values,
  onChange,
  options,
  placeholder = '미지정',
  disabled,
  className,
  ariaLabel,
  /** 트리거에 이름을 다 쓰지 않고 "OOO 외 N명" 으로 접는다 */
  summarize = true,
  footer,
}: {
  values: number[]
  onChange: (values: number[]) => void
  options: MultiOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  summarize?: boolean
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { dropUp, style: panelStyle } = useAnchoredPanel(open, triggerRef, {
    width: 'anchor',
    // 이메일 같은 설명줄이 붙으면 좁은 트리거에서도 읽히도록 더 넓게 편다.
    minWidth: options.some((o) => o.description) ? 260 : 200,
    estimatedHeight: Math.min(options.length * 40 + 56, 300),
  })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const selected = options.filter((o) => values.includes(o.value))
  const label =
    selected.length === 0
      ? placeholder
      : summarize && selected.length > 1
        ? `${selected[0].label} 외 ${selected.length - 1}명`
        : selected.map((o) => o.label).join(', ')

  const toggle = (value: number) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center gap-xs rounded-md border bg-canvas px-sm text-left text-body-md text-ink',
          'transition-colors disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted',
          open ? 'border-ink' : 'border-hairline',
        )}
      >
        {selected.length > 0 && (
          <span className="flex shrink-0 items-center">
            {selected.slice(0, 3).map((o, i) => (
              <span key={o.value} className={cn('rounded-pill ring-2 ring-canvas', i > 0 && '-ml-[8px]')}>
                {o.adornment}
              </span>
            ))}
          </span>
        )}
        <span className={cn('flex-1 truncate', selected.length === 0 && 'text-muted-soft')}>{label}</span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className={cn(
              'fixed z-[60] rounded-md border border-hairline bg-canvas shadow-card',
              'min-w-[200px] animate-scale-in',
              dropUp ? 'origin-bottom' : 'origin-top',
            )}
          >
            <ul role="listbox" aria-multiselectable className="thin-scroll max-h-[240px] overflow-y-auto p-xxs">
              {options.length === 0 && (
                <li className="px-sm py-md text-center text-caption font-normal text-muted">구성원이 없습니다.</li>
              )}
              {options.map((o) => {
                const checked = values.includes(o.value)
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(o.value)}
                      className="flex w-full items-center gap-xs rounded-sm px-sm py-xs text-left transition-colors hover:bg-surface-card"
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                          checked ? 'border-ink bg-ink text-on-primary' : 'border-hairline bg-canvas',
                        )}
                        aria-hidden
                      >
                        {checked && <Check size={11} strokeWidth={3.5} />}
                      </span>
                      {o.adornment && <span className="flex shrink-0 items-center">{o.adornment}</span>}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-body-sm', checked ? 'text-ink' : 'text-body')}>
                          {o.label}
                        </span>
                        {o.description && (
                          <span className="block truncate text-caption font-normal text-muted-soft">
                            {o.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center gap-xs border-t border-hairline-soft px-sm py-xs">
              <span className="flex-1 text-caption font-normal text-muted-soft">{values.length}명 선택됨</span>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-caption font-normal text-muted transition-colors hover:text-ink"
                >
                  전체 해제
                </button>
              )}
            </div>
            {footer}
          </div>,
          document.body,
        )}
    </div>
  )
}
