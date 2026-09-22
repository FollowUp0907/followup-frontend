import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, DueBadge, MeetingStatusBadge, PriorityBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, SectionTitle, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { OnboardingEmptyState } from '@/components/ui/OnboardingEmptyState'
import { useActionItems } from '@/features/actionItems/queries'
import { useDashboard } from '@/features/dashboard/queries'
import { useMeetingStatuses } from '@/features/meetings/useMeetingStatuses'
import { useProjectContext } from '@/features/projects/ProjectContext'
import {
  assigneeIdsOf,
  assigneeLabel,
  assigneeLabelFromNames,
  assigneeNamesOf,
} from '@/features/actionItems/assignees'
import { STATUS_DOT_COLOR } from '@/lib/constants'
import { formatDate, formatDateTime, isOverdue, progressPercent } from '@/lib/date'

/**
 * 지표 카드 — DESIGN.md 의 feature-card 규격을 따른다.
 * surface-card(#f5f5f5) 배경 + rounded-lg. 색은 쓰지 않고 회색 면과 활자 위계로만 구분한다.
 */
function StatTile({
  label,
  value,
  to,
  dot,
}: {
  label: string
  value: number
  to: string
  /** 상태 인디케이터 색. "전체 업무" 처럼 특정 상태가 아니면 생략한다. */
  dot?: string
}) {
  // 누른 순간 그 상태의 색으로 테두리를 밝힌다. 다음 화면에서 같은 색이 이어진다.
  const [pressed, setPressed] = useState(false)

  return (
    <Link
      to={to}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className="block rounded-lg bg-surface-card p-xl transition-[background-color,box-shadow,transform] duration-150 active:bg-surface-strong"
      style={
        dot && pressed
          ? { boxShadow: `0 0 0 2px ${dot}, 0 0 16px 2px ${dot}55`, transform: 'translateY(-1px)' }
          : undefined
      }
    >
      <span className="flex items-center gap-xs text-caption font-normal text-muted">
        {dot && <span className="h-2 w-2 rounded-pill" style={{ background: dot }} aria-hidden />}
        {label}
      </span>
      <span className="mt-sm block text-display-sm tabular-nums text-ink">{value}</span>
    </Link>
  )
}

export default function DashboardPage() {
  const { projectId, project, memberName } = useProjectContext()
  const { data, isLoading, isError, error, refetch } = useDashboard(projectId)
  const { statusById } = useMeetingStatuses(projectId)
  // dueSoonActionItems 에는 기한이 지난 업무가 빠져 있어서(2026-09-17 실측)
  // 지연 목록은 업무 목록에서 직접 고른다.
  const { data: allItems } = useActionItems(projectId)

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
  const overdueItems = (allItems ?? [])
    .filter((i) => isOverdue(i.dueDate, i.status))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

  // 대시보드는 훑어보는 화면이라 급한 것 3개만 보여 준다. 나머지는 "전체 보기" 로.
  const PREVIEW_COUNT = 3
  const dueSoonPreview = (data.dueSoonActionItems ?? []).slice(0, PREVIEW_COUNT)
  const overduePreview = overdueItems.slice(0, PREVIEW_COUNT)
  const header = (
    <PageHeader
      title="대시보드"
      description={`${project.name} — 전체 진행 상황`}
      actions={
        <>
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
        <StatTile label="전체 업무" value={s.total} to={`${base}/tasks`} />
        <StatTile label="예정" value={s.todo} to={`${base}/tasks?status=TODO`} dot={STATUS_DOT_COLOR.TODO} />
        <StatTile
          label="진행 중"
          value={s.inProgress}
          to={`${base}/tasks?status=IN_PROGRESS`}
          dot={STATUS_DOT_COLOR.IN_PROGRESS}
        />
        <StatTile label="완료" value={s.done} to={`${base}/tasks?status=DONE`} dot={STATUS_DOT_COLOR.DONE} />
      </div>
      <div className="mt-lg grid gap-lg lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* 마감 임박 업무 */}
        <SurfaceCard className="p-xl">
          <SectionTitle
            title="마감 임박 업무"
            description={
              s.overdue > 0
                ? `기한이 지난 업무가 ${s.overdue}건 있습니다.`
                : '완료되지 않은 업무 중 기한이 가까운 순서입니다.'
            }
            className="mb-md"
            action={
              <Link
                to={`${base}/tasks?due=soon`}
                className="text-nav-link text-muted transition-colors hover:text-ink"
              >
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
              {dueSoonPreview.map((item) => (
                <li key={item.actionItemId}>
                  <Link
                    to={`${base}/tasks/${item.actionItemId}`}
                    className="flex flex-wrap items-center justify-between gap-sm rounded-md px-xs py-xs transition-colors hover:bg-surface-soft"
                  >
                    <div className="flex min-w-0 items-center gap-sm">
                      <Avatar name={assigneeNamesOf(item)[0]} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-title-sm text-ink">{item.title}</p>
                        <p className="text-caption font-normal text-muted">
                          {assigneeLabelFromNames(assigneeNamesOf(item))} · {formatDate(item.dueDate)}
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

      {/* 아래 행 — 왼쪽: 바로 손봐야 할 지연 업무 / 오른쪽: 담당자별 진행률 */}
      <div className="mt-lg grid gap-lg lg:grid-cols-2">
        <SurfaceCard className="p-xl">
          <SectionTitle
            title="지연된 업무"
            description={s.overdue > 0 ? `기한이 지난 업무 ${s.overdue}건` : undefined}
            className="mb-md"
            action={
              <Link
                to={`${base}/tasks?due=overdue`}
                className="text-nav-link text-muted transition-colors hover:text-ink"
              >
                전체 보기
              </Link>
            }
          />
          {!overdueItems.length ? (
            <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
              지연된 업무가 없습니다.
            </p>
          ) : (
            <ul className="space-y-xxs">
              {overduePreview.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`${base}/tasks/${item.id}`}
                    className="flex items-center justify-between gap-sm rounded-md px-xs py-xs transition-colors hover:bg-surface-soft"
                  >
                    <div className="flex min-w-0 items-center gap-sm">
                      <Avatar
                        name={assigneeIdsOf(item)[0] ? memberName(assigneeIdsOf(item)[0]) : undefined}
                        size={28}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-title-sm text-ink" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-caption font-normal text-muted">
                          {assigneeLabel(assigneeIdsOf(item), memberName)} ·{' '}
                          {formatDate(item.dueDate)}
                        </p>
                      </div>
                    </div>
                    <DueBadge dueDate={item.dueDate} status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard className="p-xl">
          <SectionTitle title="담당자별 진행률" className="mb-md" />
          {!data.memberProgress?.length ? (
            <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
              구성원 정보가 없습니다.
            </p>
          ) : (
            <ul className="space-y-sm">
              {data.memberProgress.slice(0, 5).map((m) => {
                const rate = progressPercent(m.doneCount, m.totalCount, m.completionRate)
                return (
                  <li key={m.userId}>
                    <Link
                      to={`${base}/tasks?assigneeId=${m.userId}`}
                      className="flex items-center gap-sm rounded-md px-xs py-xs transition-colors hover:bg-surface-soft"
                    >
                      <Avatar name={m.name} size={28} />
                      <span className="w-[64px] truncate text-caption text-ink">{m.name}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-strong">
                        <span
                          className="block h-full rounded-pill bg-ink transition-[width]"
                          style={{ width: `${rate}%` }}
                        />
                      </span>
                      <span className="w-[56px] text-right text-caption font-normal tabular-nums text-muted">
                        {rate}%
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </>
  )
}
