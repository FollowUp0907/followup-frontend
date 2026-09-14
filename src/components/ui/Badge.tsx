import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { PRIORITY_LABEL, STATUS_LABEL, avatarColor } from '@/lib/constants'
import type { ActionItemPriority, ActionItemStatus, MeetingStatus } from '@/types/api'
import { dDayLabel, isDueSoon, isOverdue } from '@/lib/date'

type Tone = 'neutral' | 'ink' | 'success' | 'warning' | 'error' | 'info'

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-card text-body',
  ink: 'bg-ink text-on-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-[#b45309]',
  error: 'bg-error/10 text-error',
  info: 'bg-brand-accent/10 text-brand-accent',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-xxs whitespace-nowrap rounded-pill px-sm py-xxs text-caption',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const STATUS_TONE: Record<ActionItemStatus, Tone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  DONE: 'success',
}

export function StatusBadge({ status }: { status: ActionItemStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

const PRIORITY_TONE: Record<ActionItemPriority, Tone> = {
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'neutral',
}

export function PriorityBadge({ priority }: { priority?: ActionItemPriority }) {
  if (!priority) return null
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return status === 'CONFIRMED' ? <Badge tone="ink">분석 완료</Badge> : <Badge tone="neutral">작성 중</Badge>
}

/** 마감 임박 / 지연 뱃지. 완료 업무에는 붙지 않는다. */
export function DueBadge({ dueDate, status }: { dueDate?: string | null; status?: ActionItemStatus }) {
  if (!dueDate) return null
  const label = dDayLabel(dueDate)
  if (!label) return null
  if (isOverdue(dueDate, status)) return <Badge tone="error">지연 {label}</Badge>
  if (isDueSoon(dueDate, status)) return <Badge tone="warning">마감 임박 {label}</Badge>
  return <Badge tone="neutral">{label}</Badge>
}

export function Avatar({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  const label = (name ?? '?').trim()
  const initials = label ? label.slice(0, 2) : '?'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill font-semibold text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: name ? avatarColor(label) : '#e5e7eb',
        fontSize: Math.max(11, Math.round(size * 0.36)),
      }}
      title={label}
      aria-hidden
    >
      {initials}
    </span>
  )
}
