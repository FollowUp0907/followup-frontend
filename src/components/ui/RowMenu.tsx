import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAnchoredPanel } from './useAnchoredPanel'

export interface RowMenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  /** 삭제처럼 되돌리기 어려운 항목 — 빨갛게 */
  destructive?: boolean
}

/**
 * 카드·목록 행 오른쪽의 점 세 개 버튼과 그 메뉴.
 *
 * 평소에는 숨어 있다가 카드/행에 마우스를 올리면 나타난다. 그래서 바깥에
 * group 클래스가 필요하다. 키보드로 포커스하거나 메뉴가 열려 있는 동안에는
 * 마우스가 없어도 계속 보인다 — 안 그러면 탭으로 옮겨 다닐 때 버튼이 사라진다.
 *
 * 카드 전체가 눌리면 상세 패널이 열리므로, 여기서 일어나는 클릭은
 * 전부 바깥으로 새어 나가지 않게 막는다. (stopPropagation)
 *
 * 메뉴는 body 로 포털한다. 목록 뷰의 표가 overflow-x-auto 안에 있어서
 * (x 가 auto 면 y 도 auto 가 된다) 그 안에서 띄우면 아래쪽 행에서 잘린다.
 */
export function RowMenu({ items, label = '업무 메뉴' }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { dropUp, style: panelStyle } = useAnchoredPanel(open, triggerRef, {
    width: 164,
    align: 'right',
    estimatedHeight: items.length * 36 + 16,
  })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      // 메뉴가 포털로 빠져 있어서 root 만 보면 안 된다.
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
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
          'inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted',
          'transition-[opacity,background-color,color] hover:bg-surface-card hover:text-ink',
          'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ink',
          // 마우스를 올렸을 때만 보인다. 열려 있으면 계속.
          open ? 'bg-surface-card text-ink opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <MoreHorizontal size={16} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={panelStyle}
            // 포털된 메뉴의 클릭도 카드까지 새지 않게 여기서도 막는다.
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'fixed z-[60] animate-scale-in rounded-md border border-hairline bg-canvas p-xxs shadow-card',
              dropUp ? 'origin-bottom' : 'origin-top',
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
          </div>,
          document.body,
        )}
    </div>
  )
}
