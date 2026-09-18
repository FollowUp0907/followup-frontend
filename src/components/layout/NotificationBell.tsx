import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Bell, CalendarClock, CheckCircle2, Pencil, Plus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { KIND_LABEL, useNotifications } from '@/features/reminders/useNotifications'
import type { AppNotification, NotificationKind } from '@/features/reminders/useNotifications'
import { cn } from '@/lib/cn'
import { dDayLabel, dayjs, formatDate, formatDateTime } from '@/lib/date'

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  DUE_SOON: CalendarClock,
  OVERDUE: AlertTriangle,
  TASK_CREATED: Plus,
  TASK_UPDATED: Pencil,
  TASK_COMPLETED: CheckCircle2,
  UNKNOWN: Bell,
}

const KIND_COLOR: Record<NotificationKind, string> = {
  // 마감 임박 뱃지와 같은 주황 계열 — 지연(빨강)보다 한 단계 약하게
  DUE_SOON: '#b45309',
  OVERDUE: '#ef4444',
  TASK_CREATED: '#0f766e',
  TASK_UPDATED: '#64748b',
  TASK_COMPLETED: '#10b981',
  UNKNOWN: '#64748b',
}

/** D-3 / D-day / D+2. 마감이 있는 알림에만 붙는다. */
function DDay({ dueDate, kind }: { dueDate?: string; kind: NotificationKind }) {
  const label = dDayLabel(dueDate)
  if (!label) return null
  return (
    <span
      className="shrink-0 rounded-pill px-xs py-[1px] text-[11px] font-semibold"
      style={{ background: `${KIND_COLOR[kind]}1a`, color: KIND_COLOR[kind] }}
    >
      {label}
    </span>
  )
}

/**
 * 알림 종.
 * 목록 -> 상세로 들어가고 "알림 목록" 으로 돌아온다.
 * 지연 알림은 해결될 때까지 계속 보이므로 읽음/삭제가 없다.
 */
export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<AppNotification | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const { all, unreadCount, markRead, markAllRead, remove } = useNotifications(user?.userId, { active: open })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
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

  useEffect(() => {
    if (!open) setSelected(null)
  }, [open])

  const openDetail = (n: AppNotification) => {
    setSelected(n)
    if (!n.read) void markRead(n)
  }

  // 지연은 읽음이 없으니 "모두 읽음" 대상에서 뺀다. (지우는 건 된다)
  const hasUnread = all.some((n) => !n.read && n.kind !== 'OVERDUE')
  // 지난 업무는 맨 위에 따로 모아 상시 표시한다.
  const overdue = all.filter((n) => n.kind === 'OVERDUE')
  const rest = all.filter((n) => n.kind !== 'OVERDUE')

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
                <span className="min-w-0 flex-1">
                  <span className="block text-title-sm text-ink">알림</span>
                  <span className="block text-caption font-normal text-muted-soft">
                    {unreadCount > 0 ? `${unreadCount}개의 알림이 있습니다` : '모두 확인했습니다'}
                  </span>
                </span>
                {hasUnread && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="shrink-0 text-caption font-normal text-muted transition-colors hover:text-ink"
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
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted',
                selected && 'ml-auto',
              )}
            >
              <X size={15} />
            </button>
          </div>

          {selected ? (
            <DetailView
              notification={selected}
              onOpenTask={() => {
                setOpen(false)
                navigate(`/projects/${selected.projectId}/tasks/${selected.actionItemId}`)
              }}
              onRemove={() => {
                void remove(selected)
                setSelected(null)
              }}
            />
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {all.length === 0 && (
                <p className="px-md py-xl text-center text-body-sm text-muted">새로운 알림이 없습니다.</p>
              )}

              {overdue.length > 0 && (
                <section className="border-b border-hairline-soft bg-error/[0.04]">
                  <p className="flex items-center gap-xxs px-md pb-xxs pt-sm text-caption font-semibold text-error">
                    <AlertTriangle size={12} aria-hidden /> 지난 업무 {overdue.length}건
                  </p>
                  <ul className="p-xxs pt-0">
                    {overdue.map((n) => (
                      <NotificationRow
                        key={n.key}
                        notification={n}
                        onOpen={() => openDetail(n)}
                        onRemove={() => void remove(n)}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {rest.length > 0 && (
                <ul className="p-xxs">
                  {rest.map((n) => (
                    <NotificationRow
                      key={n.key}
                      notification={n}
                      onOpen={() => openDetail(n)}
                      onRemove={() => void remove(n)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailView({
  notification,
  onOpenTask,
  onRemove,
}: {
  notification: AppNotification
  onOpenTask: () => void
  onRemove: () => void
}) {
  const Icon = KIND_ICON[notification.kind]
  return (
    <div className="p-md">
      <span className="mb-sm flex flex-wrap items-center gap-xxs">
        <span
          className="inline-flex items-center gap-xxs rounded-pill px-xs py-[2px] text-caption font-semibold"
          style={{ background: `${KIND_COLOR[notification.kind]}1a`, color: KIND_COLOR[notification.kind] }}
        >
          <Icon size={12} /> {KIND_LABEL[notification.kind]}
        </span>
        <DDay dueDate={notification.dueDate} kind={notification.kind} />
      </span>
      <p className="text-title-sm text-ink">{notification.taskTitle}</p>
      {notification.at && (
        <p className="mt-xxs text-caption font-normal text-muted">
          {notification.dueDate ? `마감일 ${formatDate(notification.at)}` : formatDateTime(notification.at)}
        </p>
      )}
      {notification.kind === 'DUE_SOON' && (
        <p className="mt-xs text-caption font-normal text-muted-soft">
          마감까지 하루에 한 번 알려 드립니다. 오늘은 읽으면 접히고, 내일 다시 뜹니다.
        </p>
      )}
      {notification.kind === 'OVERDUE' && (
        <p className="mt-xs text-caption font-normal text-muted-soft">
          업무를 끝내거나 마감일을 옮기면 이 알림은 사라집니다.
        </p>
      )}
      <div className="mt-lg flex gap-xs">
        <Button size="sm" fullWidth className="min-w-0" onClick={onOpenTask}>
          업무 보기
        </Button>
        {notification.kind !== 'OVERDUE' && (
          <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={onRemove}>
            삭제
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * 알림 한 줄.
 * 안 읽은 것은 흰 바탕 + 진한 글씨 + 왼쪽 표시줄, 읽은 것은 흐리게 눕힌다.
 * 마우스를 올리면 오른쪽에 삭제가 나온다.
 */
function NotificationRow({
  notification: n,
  onOpen,
  onRemove,
}: {
  notification: AppNotification
  onOpen: () => void
  onRemove: () => void
}) {
  const Icon = KIND_ICON[n.kind]
  // 지연은 상시 알림이라 지울 수 없다. 업무를 끝내거나 마감을 옮겨야 사라진다.
  const removable = n.kind !== 'OVERDUE'
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-xs rounded-sm py-xs pl-sm text-left transition-colors hover:bg-surface-card',
          removable ? 'pr-xl' : 'pr-sm',
          !n.read && 'bg-canvas',
        )}
      >
        {/* 안 읽음 표시줄 */}
        <span
          className={cn('absolute bottom-xxs left-0 top-xxs w-[3px] rounded-pill', !n.read && 'bg-error')}
          aria-hidden
        />
        <span
          className={cn(
            'mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-sm',
            n.read && 'opacity-50',
          )}
          style={{ background: `${KIND_COLOR[n.kind]}1a`, color: KIND_COLOR[n.kind] }}
          aria-hidden
        >
          <Icon size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-xs">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-body-sm',
                n.read ? 'font-normal text-muted' : 'font-semibold text-ink',
              )}
            >
              {n.taskTitle}
            </span>
            <DDay dueDate={n.dueDate} kind={n.kind} />
          </span>
          <span className={cn('block truncate text-caption font-normal', n.read ? 'text-muted-soft' : 'text-muted')}>
            {KIND_LABEL[n.kind]}
            {n.at ? ` · ${n.dueDate ? formatDate(n.at) : dayjs(n.at).fromNow()}` : ''}
            {n.read && n.kind !== 'OVERDUE' ? ' · 읽음' : ''}
          </span>
        </span>
      </button>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${n.taskTitle} 알림 삭제`}
          className="absolute right-xxs top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-soft opacity-0 transition-opacity hover:bg-surface-strong hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      )}
    </li>
  )
}
