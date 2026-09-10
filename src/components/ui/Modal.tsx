import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/40 p-0 sm:items-center sm:p-lg">
      <button className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full animate-scale-in rounded-t-xl bg-canvas p-xl shadow-card sm:rounded-xl',
          width === 'sm' && 'sm:max-w-[420px]',
          width === 'md' && 'sm:max-w-[560px]',
          width === 'lg' && 'sm:max-w-[760px]',
        )}
      >
        <div className="mb-lg flex items-start justify-between gap-md">
          <div>
            <h2 className="text-title-lg text-ink">{title}</h2>
            {description && <p className="mt-xxs text-body-sm text-muted">{description}</p>}
          </div>
          <IconButton onClick={onClose} aria-label="닫기" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
        {children}
        {footer && <div className="mt-xl flex justify-end gap-sm">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
