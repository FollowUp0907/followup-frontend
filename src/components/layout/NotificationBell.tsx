import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { useReminders } from '@/features/reminders/store'
import type { Reminder } from '@/features/reminders/store'
import { cn } from '@/lib/cn'
import { dayjs, formatDateTime } from '@/lib/date'

/**
 * 알림 종.
 * 패널 안에서 목록 -> 상세로 들어가고, 뒤로가기로 목록에 돌아온다.
 *
 * 저장소가 브라우저라서 앱이 열려 있을 때만 알림이 뜬다. (features/reminders/store 참고)
 */
export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { due, scheduled, unreadCount, markRead, markAllRead, remove } = useReminders(user?.userId)

  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Reminder | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 상세를 보고 있으면 목록으로, 목록이면 패널을 닫는다.
      if (selected) setSelected(null)
      else setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, selected])

  // 패널을 닫으면 상세 상태도 초기화한다.
  useEffect(() => {
    if (!open) setSelected(null)
  }, [open])

  const openDetail = (r: Reminder) => {
    setSelected(r)
    if (!r.readAt) markRead(r.id)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}건` : '알림'}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-pill text-ink transition-colors active:bg-surface-card"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-error px-[3px] text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] animate-scale-in origin-top rounded-lg border border-hairline bg-canvas shadow-card">
          {/* 헤더 — 상세일 때는 뒤로가기 */}
          <div className="flex items-center gap-xs border-b border-hairline-soft px-md py-sm">
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-xxs text-nav-link text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft size={15} /> 알림 목록
              </button>
            ) : (
              <>
                <span className="text-title-sm text-ink">알림</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="ml-auto text-caption font-normal text-muted transition-colors hover:text-ink"
                  >
                    모두 읽음
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="알림 닫기"
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted',
                selected && 'ml-auto',
              )}
            >
              <X size={15} />
            </button>
          </div>

          {selected ? (
            <div className="p-md">
              <p className="text-title-sm text-ink">{selected.taskTitle}</p>
              <p className="mt-xxs text-caption font-normal text-muted">
                알림 시각 {formatDateTime(selected.remindAt)}
              </p>
              <div className="mt-lg flex gap-xs">
                <Button
                  size="sm"
                  fullWidth
                  className="min-w-0"
                  onClick={() => {
                    setOpen(false)
                    navigate(`/projects/${selected.projectId}/tasks/${selected.actionItemId}`)
                  }}
                >
                  업무 보기
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => {
                    remove(selected.id)
                    setSelected(null)
                  }}
                >
                  <Trash2 size={14} /> 삭제
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto p-xxs">
              {due.length === 0 && scheduled.length === 0 && (
                <p className="px-md py-xl text-center text-body-sm text-muted">설정한 알림이 없습니다.</p>
              )}

              {due.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openDetail(r)}
                  className="flex w-full items-start gap-xs rounded-sm px-sm py-xs text-left transition-colors hover:bg-surface-card"
                >
                  <span
                    className={cn(
                      'mt-[6px] h-1.5 w-1.5 shrink-0 rounded-pill',
                      r.readAt ? 'bg-transparent' : 'bg-error',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-body-sm', r.readAt ? 'text-body' : 'text-ink')}>
                      {r.taskTitle}
                    </span>
                    <span className="block text-caption font-normal text-muted-soft">
                      {dayjs(r.remindAt).fromNow()}
                    </span>
                  </span>
                </button>
              ))}

              {scheduled.length > 0 && (
                <>
                  <p className="px-sm pb-xxs pt-sm text-caption font-normal text-muted-soft">예정된 알림</p>
                  {scheduled.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => openDetail(r)}
                      className="flex w-full items-start gap-xs rounded-sm px-sm py-xs text-left transition-colors hover:bg-surface-card"
                    >
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-pill bg-surface-strong" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm text-body">{r.taskTitle}</span>
                        <span className="block text-caption font-normal text-muted-soft">
                          {formatDateTime(r.remindAt)}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
