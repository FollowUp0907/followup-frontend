import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, DueBadge, MeetingStatusBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, SectionTitle, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { useDashboard } from '@/features/dashboard/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { STATUS_CHART_COLOR, STATUS_LABEL } from '@/lib/constants'
import { formatDate, formatDateTime, toPercent } from '@/lib/date'

function StatTile({
  label,
  value,
  tone = 'default',
  to,
}: {
  label: string
  value: number
  tone?: 'default' | 'warning' | 'error' | 'success'
  to?: string
}) {
  const valueColor =
    tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-[#b45309]' : tone === 'success' ? 'text-success' : 'text-ink'
  const content = (
    <>
      <p className="text-caption font-normal text-muted">{label}</p>
      <p className={`mt-xs text-display-sm tabular-nums ${valueColor}`}>{value}</p>
    </>
  )
  return (
    <SurfaceCard className="p-lg">
      {to ? (
        <Link to={to} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </SurfaceCard>
  )
}

export default function DashboardPage() {
  const { projectId, project } = useProjectContext()
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard(projectId)

  const base = `/projects/${projectId}`

  if (isLoading) {
    return (
      <div className="space-y-lg">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
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
  const chartData = (['TODO', 'IN_PROGRESS', 'DONE'] as const)
    .map((key) => ({
      key,
      name: STATUS_LABEL[key],
      value: key === 'TODO' ? s.todo : key === 'IN_PROGRESS' ? s.inProgress : s.done,
    }))
    .filter((d) => d.value > 0)

  const completionRate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description || '프로젝트 진행 상황을 한눈에 확인하세요.'}
        actions={
          <>
            <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
              새로고침
            </Button>
            <ButtonLink to={`${base}/meetings/new`}>새 회의</ButtonLink>
          </>
        }
      />

      <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="전체 업무" value={s.total} to={`${base}/tasks`} />
        <StatTile label="예정" value={s.todo} to={`${base}/tasks?status=TODO`} />
        <StatTile label="진행 중" value={s.inProgress} to={`${base}/tasks?status=IN_PROGRESS`} />
        <StatTile label="완료" value={s.done} tone="success" to={`${base}/tasks?status=DONE`} />
        <StatTile label="지연" value={s.overdue} tone="error" to={`${base}/tasks?due=overdue`} />
      </div>

      <div className="mt-xxl grid gap-lg lg:grid-cols-12">
        {/* 진행률 도넛 */}
        <SurfaceCard className="p-xl lg:col-span-4">
          <h2 className="text-title-md text-ink">전체 진행률</h2>
          <div className="relative mt-md h-[200px]">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-body-sm text-muted">
                아직 업무가 없습니다.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.key} fill={STATUS_CHART_COLOR[entry.key]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: 13,
                      }}
                      formatter={(value: number, name: string) => [`${value}건`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-display-sm tabular-nums text-ink">{completionRate}%</span>
                  <span className="text-caption font-normal text-muted">완료</span>
                </div>
              </>
            )}
          </div>
          <ul className="mt-md space-y-xs">
            {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((key) => (
              <li key={key} className="flex items-center justify-between text-body-sm">
                <span className="flex items-center gap-xs text-muted">
                  <span className="h-2 w-2 rounded-pill" style={{ background: STATUS_CHART_COLOR[key] }} />
                  {STATUS_LABEL[key]}
                </span>
                <span className="tabular-nums text-ink">
                  {key === 'TODO' ? s.todo : key === 'IN_PROGRESS' ? s.inProgress : s.done}
                </span>
              </li>
            ))}
          </ul>
        </SurfaceCard>

        {/* 마감 임박 업무 */}
        <SurfaceCard className="p-xl lg:col-span-8">
          <SectionTitle
            title="마감 임박 · 지연 업무"
            description="완료되지 않은 업무 중 기한이 가까운 순서입니다."
            className="mb-md"
            action={
              <Link to={`${base}/tasks`} className="text-nav-link text-ink underline underline-offset-2">
                전체 보기
              </Link>
            }
          />
          {!data.dueSoonActionItems?.length ? (
            <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
              마감이 임박한 업무가 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {data.dueSoonActionItems.map((item) => (
                <li key={item.actionItemId}>
                  <Link
                    to={`${base}/tasks/${item.actionItemId}`}
                    className="flex flex-wrap items-center justify-between gap-sm py-sm"
                  >
                    <div className="flex min-w-0 items-center gap-sm">
                      <Avatar name={item.assigneeName ?? undefined} size={28} />
                      <div className="min-w-0">
                        <p className="truncate text-title-sm text-ink">{item.title}</p>
                        <p className="text-caption font-normal text-muted">
                          {item.assigneeName || '담당자 미지정'} · {formatDate(item.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-xs">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                      <DueBadge dueDate={item.dueDate} status={item.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      <div className="mt-lg grid gap-lg lg:grid-cols-12">
        {/* 최근 회의 */}
        <SurfaceCard className="p-xl lg:col-span-6">
          <SectionTitle
            title="최근 회의"
            className="mb-md"
            action={
              <Link to={`${base}/meetings`} className="text-nav-link text-ink underline underline-offset-2">
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
            <ul className="divide-y divide-hairline-soft">
              {data.recentMeetings.map((m) => (
                <li key={m.meetingId}>
                  <Link
                    to={`${base}/meetings/${m.meetingId}`}
                    className="flex items-center justify-between gap-sm py-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-title-sm text-ink">{m.title}</p>
                      <p className="text-caption font-normal text-muted">{formatDateTime(m.scheduledAt)}</p>
                    </div>
                    <MeetingStatusBadge status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        {/* 담당자별 진행률 */}
        <SurfaceCard className="p-xl lg:col-span-6">
          <SectionTitle title="담당자별 진행률" className="mb-md" />
          {!data.memberProgress?.length ? (
            <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
              구성원 정보가 없습니다.
            </p>
          ) : (
            <ul className="space-y-md">
              {data.memberProgress.map((m) => {
                const rate = toPercent(m.completionRate)
                return (
                  <li key={m.userId}>
                    <div className="flex items-center justify-between gap-sm">
                      <span className="flex items-center gap-xs text-body-sm text-ink">
                        <Avatar name={m.name} size={24} />
                        {m.name}
                      </span>
                      <span className="text-caption font-normal tabular-nums text-muted">
                        {m.doneCount}/{m.totalCount} · {rate}%
                      </span>
                    </div>
                    <div className="mt-xs h-2 w-full overflow-hidden rounded-pill bg-surface-card">
                      <div className="h-full rounded-pill bg-ink transition-[width]" style={{ width: `${rate}%` }} />
                    </div>
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
