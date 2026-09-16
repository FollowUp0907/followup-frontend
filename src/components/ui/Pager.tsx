import { useEffect, useMemo, useState } from 'react'
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

  return { page, setPage, pageCount, visible, needsPaging: items.length > perPage }
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
    <div className={cn('mt-md flex items-center justify-center gap-sm', className)}>
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
