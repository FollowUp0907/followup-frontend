import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageWidth } from '@/components/layout/PageWidth'
import { Pager, usePager } from '@/components/ui/Pager'
import { MeetingStatusBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { useMeetings } from '@/features/meetings/queries'
import { useMeetingStatuses } from '@/features/meetings/useMeetingStatuses'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { formatDateTime } from '@/lib/date'
import { dayjs } from '@/lib/date'

export default function MeetingListPage() {
  const { projectId } = useProjectContext()
  const { data, isLoading, isError, error, refetch } = useMeetings(projectId)
  const [query, setQuery] = useState('')
  // 백엔드가 확정 후에도 status 를 DRAFT 로 두기 때문에 화면에서 다시 판정한다.
  const { statusById } = useMeetingStatuses(projectId)
  const base = `/projects/${projectId}`

  // 백엔드 정렬을 신뢰하지 않고 최신순으로 한 번 더 정렬한다.
  const keyword = query.trim().toLowerCase()
  const meetings = [...(data ?? [])]
    .filter((m) => !keyword || m.title.toLowerCase().includes(keyword))
    .sort((a, b) => dayjs(b.scheduledAt).valueOf() - dayjs(a.scheduledAt).valueOf())

  // 한 화면에 들어오도록 5개씩 끊는다.
  const page = usePager(meetings, 7)

  return (
    <PageWidth size={1120}>
      <PageHeader
        title="회의"
        description="회의록을 작성하고 과거 회의를 확인하세요."
        actions={
          <ButtonLink to={`${base}/meetings/new`}>
            <Plus size={16} /> 새 회의
          </ButtonLink>
        }
      />

      {/* 회의 제목 검색 — 백엔드에 검색 파라미터가 없어 받아 온 목록에서 거른다 */}
      <div className="relative mb-lg">
        <Search size={16} className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          className="pl-xl"
          placeholder="회의 제목 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="회의 제목 검색"
        />
      </div>

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
          title={keyword ? '검색 결과가 없습니다' : '아직 기록된 회의가 없어요'}
          description={keyword ? `"${query}" 와 일치하는 회의가 없습니다.` : '첫 회의를 만들어 회의록을 남겨보세요.'}
          action={
            keyword ? (
              <Button variant="secondary" onClick={() => setQuery('')}>
                검색 지우기
              </Button>
            ) : (
              <ButtonLink to={`${base}/meetings/new`}>새 회의 만들기</ButtonLink>
            )
          }
        />
      )}

      {meetings.length > 0 && (
        <div>
          <ul key={page.page} className="animate-page-in space-y-sm">
            {page.visible.map((m) => (
            <SurfaceCard as="li" key={m.id} className="shadow-none transition-shadow hover:shadow-card">
              <Link
                to={`${base}/meetings/${m.id}`}
                className="flex flex-wrap items-center justify-between gap-md px-xl py-lg"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-sm">
                    <h2 className="truncate text-title-md text-ink">{m.title}</h2>
                    <MeetingStatusBadge status={statusById.get(m.id) ?? m.status} />
                  </div>
                  <p className="mt-xxs text-body-sm text-muted">{formatDateTime(m.scheduledAt)}</p>
                </div>
                <span className="text-nav-link text-muted">상세 보기 →</span>
              </Link>
            </SurfaceCard>
            ))}
          </ul>
          <Pager page={page.page} pageCount={page.pageCount} onChange={page.setPage}  />
        </div>
      )}
    </PageWidth>
  )
}
