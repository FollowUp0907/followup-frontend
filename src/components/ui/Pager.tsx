import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * 목록이 길어질 때 스크롤 대신 페이지로 넘긴다.
 * 아래에 현재 위치 인디케이터를 두고, 좌우 원형 버튼으로 이동한다.
 */
export function usePager<T>(items: T[], perPage: number) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / perPage))

  // 목록이 줄어 현재 페이지가 사라지면 마지막 페이지로 당긴다.
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1)
  }, [page, pageCount])

  const visible = useMemo(() => items.slice(page * perPage, page * perPage + perPage), [items, page, perPage])

  const go = useCallback((next: number) => setPage(Math.min(pageCount - 1, Math.max(0, next))), [pageCount])

  /**
   * 좌우로 끌면 페이지가 넘어가게 하는 핸들러.
   * 카드의 HTML5 드래그앤드롭과 부딪히지 않도록 포인터 제스처로만 판정하고,
   * 가로 이동이 세로보다 확실히 클 때(45px 이상)에만 페이지를 넘긴다.
   */
  const swipe = useSwipe(
    useCallback(() => go(page + 1), [go, page]),
    useCallback(() => go(page - 1), [go, page]),
  )

  return { page, setPage: go, pageCount, visible, needsPaging: items.length > perPage, swipe }
}

/** 가로 스와이프(포인터 드래그 + 트랙패드 가로 스크롤) */
function useSwipe(onNext: () => void, onPrev: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const wheelLock = useRef(0)

  return {
    onPointerDown: (e: React.PointerEvent) => {
      // 카드 자체를 잡고 끄는 건 카드 드래그이므로 제외한다.
      if ((e.target as HTMLElement).closest('[draggable="true"]')) return
      start.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const from = start.current
      start.current = null
      if (!from) return
      const dx = e.clientX - from.x
      const dy = e.clientY - from.y
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return
      if (dx < 0) onNext()
      else onPrev()
    },
    onWheel: (e: React.WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 25) return
      const now = Date.now()
      if (now - wheelLock.current < 400) return
      wheelLock.current = now
      if (e.deltaX > 0) onNext()
      else onPrev()
    },
  }
}

export function Pager({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
  className?: string
}) {
  if (pageCount <= 1) return null
  return (
    <div className={cn('mt-xs flex items-center justify-center gap-sm', className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label="이전 페이지"
        className="inline-flex h-8 w-8 items-center justify-center rounded-pill border border-hairline text-ink transition-colors active:bg-surface-card disabled:text-muted-soft"
      >
        <ChevronLeft size={15} />
      </button>

      <div className="flex items-center gap-xxs" role="tablist" aria-label="페이지">
        {Array.from({ length: pageCount }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === page}
            aria-label={`${i + 1}페이지`}
            onClick={() => onChange(i)}
            className={cn('h-1.5 rounded-pill transition-all', i === page ? 'w-5 bg-ink' : 'w-1.5 bg-surface-strong')}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        aria-label="다음 페이지"
        className="inline-flex h-8 w-8 items-center justify-center rounded-pill border border-hairline text-ink transition-colors active:bg-surface-card disabled:text-muted-soft"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
