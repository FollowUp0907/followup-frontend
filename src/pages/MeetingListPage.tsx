import { Link } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { useMeetings } from '@/features/meetings/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { formatDateTime } from '@/lib/date'
import { dayjs } from '@/lib/date'

export default function MeetingListPage() {
  const { projectId } = useProjectContext()
  const { data, isLoading, isError, error, refetch } = useMeetings(projectId)
  const base = `/projects/${projectId}`

  // 백엔드 정렬을 신뢰하지 않고 최신순으로 한 번 더 정렬한다.
  const meetings = [...(data ?? [])].sort((a, b) => dayjs(b.scheduledAt).valueOf() - dayjs(a.scheduledAt).valueOf())

  return (
    <>
      <PageHeader
        title="회의"
        description="회의를 만들고 회의록을 작성하면 AI 분석으로 이어집니다."
        actions={<ButtonLink to={`${base}/meetings/new`}>새 회의</ButtonLink>}
      />

      {isLoading && (
        <div className="space-y-sm">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[84px]" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          title="회의 목록을 불러오지 못했습니다"
          description={errorMessage(error)}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        />
      )}

      {!isLoading && !isError && meetings.length === 0 && (
        <EmptyState
          title="아직 회의가 없습니다"
          description="첫 회의를 만들고 회의록을 붙여 넣어 보세요."
          action={<ButtonLink to={`${base}/meetings/new`}>새 회의 만들기</ButtonLink>}
        />
      )}

      {meetings.length > 0 && (
        <ul className="space-y-sm">
          {meetings.map((m) => (
            <SurfaceCard as="li" key={m.id} className="transition-shadow hover:shadow-card">
              <Link to={`${base}/meetings/${m.id}`} className="flex flex-wrap items-center justify-between gap-md p-lg">
                <div className="min-w-0">
                  <div className="flex items-center gap-sm">
                    <h2 className="truncate text-title-md text-ink">{m.title}</h2>
                    <MeetingStatusBadge status={m.status} />
                  </div>
                  <p className="mt-xxs text-body-sm text-muted">{formatDateTime(m.scheduledAt)}</p>
                </div>
                <span className="text-nav-link text-muted">상세 보기 →</span>
              </Link>
            </SurfaceCard>
          ))}
        </ul>
      )}
    </>
  )
}
