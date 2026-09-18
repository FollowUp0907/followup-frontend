import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { PRIORITY_LABEL, STATUS_LABEL, avatarColor } from '@/lib/constants'
import { useAvatarColors } from '@/features/members/avatarColor'
import type { ActionItemPriority, ActionItemStatus, MeetingStatus } from '@/types/api'
import { dDayLabel } from '@/lib/date'

type Tone =
  | 'neutral'
  | 'ink'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'violet'
  | 'violet-strong'
  | 'teal'
  | 'orange'
  | 'pink'
  | 'emerald'

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-card text-body',
  ink: 'bg-ink text-on-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-[#b45309]',
  error: 'bg-error/10 text-error',
  info: 'bg-brand-accent/10 text-brand-accent',
  // DESIGN.md 의 파스텔 — 태그 pill 용
  violet: 'bg-badge-violet/12 text-[#6d28d9]',
  'violet-strong': 'bg-[#4338ca]/10 text-[#3730a3]',
  teal: 'bg-[#0f766e]/10 text-[#115e59]',
  orange: 'bg-badge-orange/15 text-[#c2410c]',
  pink: 'bg-badge-pink/12 text-[#be185d]',
  emerald: 'bg-badge-emerald/15 text-[#047857]',
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

// 마감 배지(빨강·주황)와 겹치지 않도록 우선순위는 보라 계열로 둔다.
// 낮음·보통·높음이 서로 다르고, 마감 배지(빨강·주황)와도 겹치지 않게.
const PRIORITY_TONE: Record<ActionItemPriority, Tone> = {
  HIGH: 'error',
  MEDIUM: 'teal',
  LOW: 'neutral',
}

export function PriorityBadge({ priority }: { priority?: ActionItemPriority }) {
  if (!priority) return null
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return status === 'CONFIRMED' ? <Badge tone="ink">분석 완료</Badge> : <Badge tone="neutral">작성 중</Badge>
}

/**
 * 마감 뱃지 — D-3 / D-day / D+2 만 보여 준다.
 *
 * "지연" "마감 임박" 같은 말과 빨강·주황은 뺐다. 목록에 뱃지가 여러 개
 * 나란히 서면 색이 서로 싸워서, 마감은 무채색으로 통일하고 급한 정도는
 * D-day 숫자 자체가 말하게 둔다. 완료 업무에는 붙지 않는다.
 */
export function DueBadge({ dueDate, status }: { dueDate?: string | null; status?: ActionItemStatus }) {
  if (!dueDate || status === 'DONE') return null
  const label = dDayLabel(dueDate)
  if (!label) return null
  return <Badge tone="neutral">{label}</Badge>
}

export function Avatar({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  const overrides = useAvatarColors()
  const label = (name ?? '').trim()
  // 구성원 페이지에서 고른 색이 있으면 그걸, 없으면 이름으로 고른 기본색을 쓴다.
  const background = label ? (overrides[label] ?? avatarColor(label)) : '#e5e7eb'
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill', className)}
      style={{ width: size, height: size, background }}
      title={label || '미지정'}
      aria-hidden
    >
      {/* 이니셜 대신 사람 실루엣. 바탕이 아주 흐려서 실루엣은 잉크를 옅게 얹는다. */}
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        fill={label ? 'rgba(17,17,17,0.55)' : 'rgba(17,17,17,0.28)'}
        aria-hidden
      >
        <circle cx="12" cy="8.2" r="3.9" />
        <path d="M12 13.4c-4 0-7.2 2.3-7.2 5.2 0 .8.7 1.4 1.6 1.4h11.2c.9 0 1.6-.6 1.6-1.4 0-2.9-3.2-5.2-7.2-5.2Z" />
      </svg>
    </span>
  )
}
