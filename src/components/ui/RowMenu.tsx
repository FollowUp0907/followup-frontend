import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface RowMenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  /** 삭제처럼 되돌리기 어려운 항목 — 빨갛게 */
  destructive?: boolean
}

/**
 * 카드·목록 행 오른쪽의 톱니 버튼과 그 메뉴.
 *
 * 카드 전체가 눌리면 상세 패널이 열리므로, 여기서 일어나는 클릭은
 * 전부 바깥으로 새어 나가지 않게 막는다. (stopPropagation)
 * 위치는 열 때 재 보고 아래 공간이 모자라면 위로 펼친다.
 */
export function RowMenu({ items, label = '업무 설정' }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 상세 패널이나 모달까지 같이 닫히지 않게 여기서 끊는다.
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

  useLayoutEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setDropUp(window.innerHeight - rect.bottom < 8 + items.length * 36 + 16)
  }, [open, items.length])

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      // 카드 클릭(상세 열기)·드래그와 겹치지 않게 이 영역의 이벤트는 가둔다.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      draggable={false}
      onDragStart={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted transition-colors',
          'hover:bg-surface-card hover:text-ink',
          open && 'bg-surface-card text-ink',
        )}
      >
        <Settings size={15} />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-30 w-[164px] animate-scale-in rounded-md border border-hairline bg-canvas p-xxs shadow-card',
            dropUp ? 'bottom-[calc(100%+4px)] origin-bottom' : 'top-[calc(100%+4px)] origin-top',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-xs rounded-sm px-sm py-xs text-left text-body-sm transition-colors',
                item.destructive ? 'text-error hover:bg-error/5' : 'text-body hover:bg-surface-card hover:text-ink',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
