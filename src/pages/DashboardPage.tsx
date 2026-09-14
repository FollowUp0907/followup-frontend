import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FileText,
  ListTodo,
  Loader,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, DueBadge, MeetingStatusBadge, PriorityBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, SectionTitle, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { OnboardingEmptyState } from '@/components/ui/OnboardingEmptyState'
import { useDashboard } from '@/features/dashboard/queries'
import { useMeetingStatuses } from '@/features/meetings/useMeetingStatuses'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { ACCENT, SUMMARY_ACCENT, avatarColor } from '@/lib/constants'
import { formatDate, formatDateTime, progressPercent } from '@/lib/date'

function StatTile({
  label,
  value,
  to,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  to: string
  color: string
  icon: LucideIcon
}) {
  return (
    <SurfaceCard className="shadow-none transition-shadow hover:shadow-card">
      <Link to={to} className="block p-xl">
        <span className="mb-md flex items-center justify-between">
          <span className="text-caption font-normal text-muted">{label}</span>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ background: `${color}1f`, color }}
            aria-hidden
          >
            <Icon size={15} />
          </span>
        </span>
        <span className="block text-display-sm tabular-nums" style={{ color }}>
          {value}
        </span>
      </Link>
    </SurfaceCard>
  )
}

export default function DashboardPage() {
  const { projectId, project } = useProjectContext()
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard(projectId)
  const { statusById } = useMeetingStatuses(projectId)

  const base = `/projects/${projectId}`

  if (isLoading) {
    return (
      <div className="space-y-lg">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="h-[280px]" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="대시보드를 불러오지 못했습니다"
        description={errorMessage(error)}
        action={
          <Button variant="secondary" onClick={() => refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const s = data.actionItemSummary
  const header = (
    <PageHeader
      title="대시보드"
      description={`${project.name} — 전체 진행 상황`}
      actions={
        <>
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw size={15} /> 새로고침
          </Button>
          <ButtonLink to={`${base}/meetings/new`}>
            <Plus size={16} /> 새 회의
          </ButtonLink>
        </>
      }
    />
  )

  // 시안: 회의가 한 건도 없으면 지표 대신 온보딩을 띄운다
  if (!data.recentMeetings?.length && s.total === 0) {
    return (
      <>
        {header}
        <OnboardingEmptyState newMeetingTo={`${base}/meetings/new`} membersTo={`${base}/members`} />
      </>
    )
  }

  return (
    <>
      {header}

      <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="전체 업무" value={s.total} to={`${base}/tasks`} color={SUMMARY_ACCENT.total} icon={ListTodo} />
        <StatTile
          label="예정"
          value={s.todo}
          to={`${base}/tasks?status=TODO`}
          color={SUMMARY_ACCENT.todo}
          icon={CircleDashed}
        />
        <StatTile
          label="진행 중"
          value={s.inProgress}
          to={`${base}/tasks?status=IN_PROGRESS`}
          color={SUMMARY_ACCENT.inProgress}
          icon={Loader}
        />
        <StatTile
          label="완료"
          value={s.done}
          to={`${base}/tasks?status=DONE`}
          color={SUMMARY_ACCENT.done}
          icon={CheckCircle2}
        />
      </div>

      <div className="mt-lg grid gap-lg lg:grid-cols-[1.2fr_1fr]">
        {/* 마감 임박 업무 */}
        <SurfaceCard className="p-xl">
          <SectionTitle
            title="마감 임박 업무"
            icon={<CalendarClock size={14} />}
            iconColor={ACCENT.orange}
            description={
              s.overdue > 0
                ? `기한이 지난 업무가 ${s.overdue}건 있습니다.`
                : '완료되지 않은 업무 중 기한이 가까운 순서입니다.'
            }
            className="mb-md"
            action={
              <Link to={`${base}/tasks`} className="text-nav-link text-muted transition-colors hover:text-ink">
                전체 보기
              </Link>
            }
          />
          {!data.dueSoonActionItems?.length ? (
            <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
              마감이 임박한 업무가 없습니다.
            </p>
          ) : (
            <ul className="space-y-xxs">
              {data.dueSoonActionItems.map((item) => (
                <li key={item.actionItemId}>
                  <Link
                    to={`${base}/tasks/${item.actionItemId}`}
                    className="flex flex-wrap items-center justify-between gap-sm rounded-md px-xs py-xs transition-colors hover:bg-surface-soft"
                  >
                    <div className="flex min-w-0 items-center gap-sm">
                      <Avatar name={item.assigneeName ?? undefined} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-title-sm text-ink">{item.title}</p>
                        <p className="text-caption font-normal text-muted">
                          {item.assigneeName || '담당자 미지정'} · {formatDate(item.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-xs">
                      <PriorityBadge priority={item.priority} />
                      <DueBadge dueDate={item.dueDate} status={item.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        {/* 최근 회의 */}
        <SurfaceCard className="p-xl">
          <SectionTitle
            title="최근 회의"
            icon={<FileText size={14} />}
            iconColor={ACCENT.violet}
            className="mb-md"
            action={
              <Link to={`${base}/meetings`} className="text-nav-link text-muted transition-colors hover:text-ink">
                전체 보기
              </Link>
            }
          />
          {!data.recentMeetings?.length ? (
            <div className="rounded-md bg-surface-soft px-md py-lg text-center">
              <p className="text-body-sm text-muted">아직 회의가 없습니다.</p>
              <ButtonLink to={`${base}/meetings/new`} variant="secondary" size="sm" className="mt-sm">
                첫 회의 만들기
              </ButtonLink>
            </div>
          ) : (
            <ul className="space-y-xxs">
              {data.recentMeetings.map((m) => (
                <li key={m.meetingId}>
                  <Link
                    to={`${base}/meetings/${m.meetingId}`}
                    className="flex items-center justify-between gap-sm rounded-md px-xs py-xs transition-colors hover:bg-surface-soft"
                  >
                    <div className="flex min-w-0 items-center gap-sm">
                      <FileText size={16} className="shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="truncate text-title-sm text-ink">{m.title}</p>
                        <p className="text-caption font-normal text-muted">{formatDateTime(m.scheduledAt)}</p>
                      </div>
                    </div>
                    <MeetingStatusBadge status={statusById.get(m.meetingId) ?? m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      {/* 담당자별 진행률 — 시안은 전폭 */}
      <SurfaceCard className="mt-lg p-xl">
        <SectionTitle title="담당자별 진행률" className="mb-md" icon={<Users size={14} />} iconColor={ACCENT.emerald} />
        {!data.memberProgress?.length ? (
          <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
            구성원 정보가 없습니다.
          </p>
        ) : (
          <ul className="space-y-sm">
            {data.memberProgress.map((m) => {
              const rate = progressPercent(m.doneCount, m.totalCount, m.completionRate)
              return (
                <li key={m.userId}>
                  <Link
                    to={`${base}/tasks?assigneeId=${m.userId}`}
                    className="flex items-center gap-md rounded-md px-xs py-xs transition-colors hover:bg-surface-soft"
                  >
                    <Avatar name={m.name} size={32} />
                    <span className="w-[80px] shrink-0 truncate text-body-sm text-ink">{m.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-strong">
                      <span
                        className="block h-full rounded-pill transition-[width]"
                        style={{ width: `${rate}%`, background: avatarColor(m.userId) }}
                      />
                    </span>
                    <span className="w-[70px] shrink-0 text-right text-caption font-normal tabular-nums text-muted">
                      {m.doneCount}/{m.totalCount} · {rate}%
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </SurfaceCard>
    </>
  )
}
