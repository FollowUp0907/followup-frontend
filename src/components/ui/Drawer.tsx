import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

/** 닫힘 애니메이션 길이. tailwind.config 의 slide-out-right 와 맞춘다. */
const EXIT_MS = 200

/**
 * 오른쪽에서 밀려 들어오는 패널.
 *
 * Modal 과 달리 화면을 덮지 않고 옆에 붙는다. 목록을 그대로 둔 채 하나를
 * 들여다보는 용도라, 닫으면 보던 자리로 바로 돌아온다.
 *
 * 닫을 때도 미끄러져 나가야 해서, open 이 false 가 된 뒤에도 애니메이션이
 * 끝날 때까지 잠깐 더 붙들고 있다가 떼어 낸다.
 *
 * Esc 와 바깥 클릭으로 닫히고, 열릴 때 패널로 포커스를 옮겼다가
 * 닫히면 열기 전에 보던 요소로 되돌린다.
 *
 * 내용이 넘치면 본문만 스크롤하는데, 얇은 스크롤바만으로는 "잘린 것" 처럼 보여서
 * 아래에 더 있을 때 옅은 그라데이션을 깔아 이어진다는 걸 알린다.
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
  const [mounted, setMounted] = useState(open)
  const [moreBelow, setMoreBelow] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  // 아래에 더 있는지 — 내용이 바뀌거나 스크롤할 때마다 다시 잰다.
  const measure = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (!mounted || !el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [mounted, measure, children])

  // 열리면 바로 붙이고, 닫히면 미끄러져 나갈 시간을 준 뒤 뗀다.
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    if (!mounted) return
    const t = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [open, mounted])

  useEffect(() => {
    if (!mounted) return
    restoreTo.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      restoreTo.current?.focus?.()
    }
  }, [mounted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        className={cn(
          'absolute inset-0 cursor-default bg-ink/25 motion-reduce:animate-none',
          open ? 'animate-veil-in' : 'animate-veil-out',
        )}
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'absolute right-0 top-0 flex h-full w-full flex-col border-l border-hairline bg-canvas shadow-card outline-none',
          // 좁으면 내용이 잘려 보인다. 화면이 커질수록 넉넉하게.
          'sm:w-[440px] md:w-[520px] lg:w-[580px]',
          'motion-reduce:animate-none',
          open ? 'animate-slide-in-right' : 'animate-slide-out-right',
        )}
      >
        <div className="flex items-center gap-sm border-b border-hairline-soft px-lg py-md">
          <h2 className="min-w-0 flex-1 truncate text-title-md text-ink">{title}</h2>
          <IconButton onClick={onClose} aria-label="닫기" type="button" className="h-8 w-8 shrink-0">
            <X size={15} />
          </IconButton>
        </div>

        <div className="relative min-h-0 flex-1">
          {/*
            기본은 패널 자체가 스크롤되지 않는 것 — 내용이 화면 높이에 맞춰 들어간다.
            그래도 넘치는 화면(아주 낮은 창, 수정 폼)에서는 내용이 닿지 않으면 안 되니
            넘칠 때만 스크롤을 허용하고, 그때는 아래 그라데이션으로 알린다.
          */}
          <div ref={bodyRef} onScroll={measure} className="thin-scroll h-full overflow-y-auto overflow-x-hidden px-lg py-lg">
            {children}
          </div>
          {/* 아래에 더 있을 때만 — 내용이 끊긴 게 아니라 이어진다는 표시 */}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-canvas to-transparent transition-opacity',
              moreBelow ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden
          />
        </div>

        {footer && <div className="flex gap-sm border-t border-hairline-soft px-lg py-md">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
