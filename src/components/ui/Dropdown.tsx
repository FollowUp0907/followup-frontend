import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAnchoredPanel } from './useAnchoredPanel'

/**
 * 커스텀 드롭다운 (DESIGN.md 준수)
 *
 * 네이티브 <select> 는 OS 마다 생김새가 달라서 디자인 시스템을 벗어난다.
 * 트리거는 text-input 스펙(h-40 / rounded-md / hairline), 패널은 canvas + hairline +
 * shadow-card, 항목은 rounded-sm (DESIGN.md 에서 dropdown item 에 지정한 값).
 *
 * 패널은 body 로 포털해서 position:fixed 로 띄운다. 목록 뷰의 표처럼
 * overflow 가 걸린 상자 안에 들어가면 그 안에 갇혀 잘리기 때문이다.
 * (overflow-x:auto 는 overflow-y 도 auto 로 만든다)
 *
 * 접근성:
 *  - 트리거 role=combobox, 패널 role=listbox, 항목 role=option
 *  - 키보드: Enter/Space/↓/↑ 로 열기, ↑↓ 이동, Home/End, Enter 선택, Esc 닫기,
 *            타이핑하면 해당 글자로 시작하는 항목으로 점프
 *  - 열릴 때 선택 항목으로 포커스, 닫힐 때 트리거로 포커스 복귀
 */

export interface DropdownOption<T extends string> {
  value: T
  label: string
  /** 앞에 붙는 표식 — 상태 점, 우선순위 아이콘, 아바타 등 */
  adornment?: ReactNode
  /** 항목 아래 보조 설명 */
  description?: string
}

interface DropdownProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Array<DropdownOption<T>>
  /** value 가 빈 문자열일 때 트리거에 보일 문구 */
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  /** 트리거에 연결할 label 의 id */
  ariaLabelledBy?: string
  ariaLabel?: string
}

export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder = '선택',
  disabled,
  invalid,
  className,
  ariaLabelledBy,
  ariaLabel,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ query: '', at: 0 })

  const listId = useId()
  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value])
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const { dropUp, style: panelStyle } = useAnchoredPanel(open, triggerRef, {
    width: 'anchor',
    // 이메일 같은 설명줄이 붙으면 좁은 트리거에서도 읽히도록 더 넓게 편다.
    minWidth: options.some((o) => o.description) ? 260 : 180,
    estimatedHeight: Math.min(options.length * 40 + 16, 280),
  })

  useEffect(() => {
    if (!open) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

  // 활성 항목을 스크롤 범위 안으로
  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current?.querySelectorAll('[role="option"]')[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      // 패널이 포털로 빠져 있어서 root 만 보면 안 된다.
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  const pick = (index: number) => {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        // 모달 안에서 열렸을 때 Esc 가 모달까지 닫아 버리지 않도록 여기서 끊는다.
        // (Modal 은 document 에 keydown 을 걸어 둔다)
        e.stopPropagation()
        close()
        break
      case 'Tab':
        setOpen(false)
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % options.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + options.length) % options.length)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        pick(activeIndex)
        break
      default: {
        if (e.key.length !== 1) return
        const now = Date.now()
        const state = typeahead.current
        state.query = now - state.at > 700 ? e.key : state.query + e.key
        state.at = now
        const found = options.findIndex((o) => o.label.toLowerCase().startsWith(state.query.toLowerCase()))
        if (found >= 0) setActiveIndex(found)
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-10 w-full items-center gap-xs rounded-md border bg-canvas px-sm text-left text-body-md text-ink',
          'transition-colors disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted',
          open ? 'border-ink' : 'border-hairline',
          invalid && 'border-error',
        )}
      >
        {selected?.adornment && <span className="flex shrink-0 items-center">{selected.adornment}</span>}
        <span className={cn('flex-1 truncate', !selected && 'text-muted-soft')}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={ariaLabelledBy}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            style={panelStyle}
            className={cn(
              'fixed z-[60] max-h-[280px] min-w-[180px] animate-scale-in overflow-y-auto rounded-md border border-hairline',
              'bg-canvas p-xxs shadow-card',
              dropUp ? 'origin-bottom' : 'origin-top',
            )}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-xs rounded-sm px-sm py-xs text-body-sm transition-colors',
                    index === activeIndex ? 'bg-surface-card text-ink' : 'text-body',
                  )}
                >
                  {option.adornment && <span className="flex shrink-0 items-center">{option.adornment}</span>}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', isSelected && 'font-semibold text-ink')}>{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-caption font-normal text-muted-soft">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check size={15} className="shrink-0 text-ink" aria-hidden />}
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </div>
  )
}
