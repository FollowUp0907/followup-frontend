import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './Button'

/**
 * 오른쪽에서 밀려 들어오는 패널.
 *
 * Modal 과 달리 화면을 덮지 않고 옆에 붙는다. 목록을 그대로 둔 채 하나를
 * 들여다보는 용도라, 닫으면 보던 자리로 바로 돌아온다.
 *
 * Esc 와 바깥 클릭으로 닫히고, 열릴 때 패널로 포커스를 옮겨 뒀다가
 * 닫히면 열기 전에 보던 요소로 되돌린다.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 animate-veil-in cursor-default bg-ink/25"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full animate-slide-in-right flex-col border-l border-hairline bg-canvas shadow-card outline-none sm:w-[440px]"
      >
        <div className="flex items-center gap-sm border-b border-hairline-soft px-lg py-md">
          <h2 className="min-w-0 flex-1 truncate text-title-md text-ink">{title}</h2>
          <IconButton onClick={onClose} aria-label="닫기" type="button" className="h-8 w-8 shrink-0">
            <X size={15} />
          </IconButton>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto px-lg py-lg">{children}</div>

        {footer && <div className="flex gap-sm border-t border-hairline-soft px-lg py-md">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
