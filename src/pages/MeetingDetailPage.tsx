import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { FitPage } from '@/components/layout/FitPage'
import { Pager, usePager } from '@/components/ui/Pager'
import { Avatar, DueBadge, MeetingStatusBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { deriveMeetingStatus } from '@/features/meetings/useMeetingStatuses'
import { useMeetingActionItems } from '@/features/actionItems/useMeetingActionItems'
import { useMeeting, useUpdateMeeting } from '@/features/meetings/queries'
import { useCascadeDelete } from '@/features/projects/useCascadeDelete'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { assigneeIdsOf, assigneeLabel } from '@/features/actionItems/assignees'
import {
  formatDate,
  formatDateTime,
  formatServerDateTime,
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from '@/lib/date'

export default function MeetingDetailPage() {
  const { projectId, memberName } = useProjectContext()
  const params = useParams()
  const meetingId = Number(params.meetingId)
  const navigate = useNavigate()
  const toast = useToast()

  const { data: meeting, isLoading, isError, error } = useMeeting(meetingId)
  const updateMeeting = useUpdateMeeting(projectId, meetingId)
  const { deleteMeetingCascade } = useCascadeDelete(projectId)
  const [deleting, setDeleting] = useState(false)
  const { items: generatedItems, isLoading: generatedLoading } = useMeetingActionItems(projectId, meetingId)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [content, setContent] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false)

  useEffect(() => {
    if (!meeting) return
    setTitle(meeting.title)
    setScheduledAt(toDateTimeLocalInput(meeting.scheduledAt))
    setContent(meeting.content ?? '')
  }, [meeting])

  const base = `/projects/${projectId}`
  // 백엔드가 확정 후에도 status 를 DRAFT 로 남기므로 결정 사항 유무로 다시 판정한다.
  const effectiveStatus = deriveMeetingStatus(meeting, generatedItems.length > 0)
  // 연결된 이전 업무가 많아지면 스크롤 대신 5개씩 페이지로 넘긴다.
  const carryOverPage = usePager(meeting?.carryOverActionItems ?? [], 5)

  if (isLoading) {
    return (
      <div className="space-y-lg">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-[320px]" />
      </div>
    )
  }

  if (isError || !meeting) {
    return (
      <EmptyState
        title="회의를 불러오지 못했습니다"
        description={errorMessage(error)}
        action={
          <ButtonLink to={`${base}/meetings`} variant="secondary">
            회의 목록으로
          </ButtonLink>
        }
      />
    )
  }

  const hasContent = !!meeting.content?.trim()

  const saveContent = async () => {
    // 회의록 본문이 바뀌었고 이미 분석한 회의라면, 저장 후 재분석을 물어본다.
    const contentChanged = content.trim() !== (meeting?.content ?? '').trim()
    try {
      await updateMeeting.mutateAsync({
        title,
        scheduledAt: fromDateTimeLocalInput(scheduledAt),
        content,
      })
      setEditing(false)
      if (contentChanged && effectiveStatus === 'CONFIRMED') {
        setReanalyzeOpen(true)
      } else {
        toast.success('회의록을 저장했습니다.')
      }
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const onDelete = async () => {
    setDeleting(true)
    try {
      // 후속 업무는 지우지 않는다. 업무는 회의보다 오래 남아야 한다.
      await deleteMeetingCascade(meetingId)
      toast.success('회의를 삭제했습니다.')
      navigate(`${base}/meetings`, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <FitPage>
      <PageHeader
        title={meeting.title}
        description={formatDateTime(meeting.scheduledAt)}
        breadcrumb={
          <Link to={`${base}/meetings`} className="text-nav-link text-muted">
            ← 회의 목록
          </Link>
        }
        actions={
          <>
            <MeetingStatusBadge status={effectiveStatus} />
            <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? '편집 취소' : '회의 수정'}
            </Button>
            <ButtonLink to={`${base}/meetings/${meetingId}/analysis`}>
              {effectiveStatus === 'CONFIRMED' ? '결과 보기' : 'AI 분석하기'}
            </ButtonLink>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 gap-md lg:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-md lg:col-span-8">
          <SurfaceCard className="flex min-h-[200px] flex-1 flex-col p-lg">
            <div className="mb-sm flex shrink-0 items-center justify-between gap-md">
              <h2 className="text-title-md text-ink">회의록</h2>
              {editing && (
                <Button size="sm" onClick={saveContent} loading={updateMeeting.isPending}>
                  저장
                </Button>
              )}
            </div>

            {editing ? (
              <div className="space-y-md">
                <FormRow label="회의 제목" htmlFor="edit-title">
                  <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </FormRow>
                <FormRow label="회의 일시" htmlFor="edit-date">
                  <Input
                    id="edit-date"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </FormRow>
                <FormRow label="회의록" htmlFor="edit-content">
                  <Textarea
                    id="edit-content"
                    className="min-h-[320px]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="회의에서 나온 이야기를 그대로 적어 주세요."
                  />
                </FormRow>
              </div>
            ) : hasContent ? (
              <p className="thin-scroll min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-card p-md text-body-md leading-relaxed text-body">
                {meeting.content}
              </p>
            ) : (
              <EmptyState
                title="회의록이 비어 있습니다"
                description="회의 수정을 눌러 회의록을 작성하면 AI 분석을 요청할 수 있습니다."
                action={<Button onClick={() => setEditing(true)}>회의록 작성</Button>}
              />
            )}
          </SurfaceCard>

          <SurfaceCard className="flex min-h-0 shrink-0 flex-col p-lg">
            <h2 className="mb-sm text-title-md text-ink">결정 사항</h2>
            {!meeting.decisions?.length ? (
              <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
                아직 확정된 결정 사항이 없습니다. AI 분석 결과를 확정하면 여기에 표시됩니다.
              </p>
            ) : (
              <ul className="space-y-xs">
                {meeting.decisions.map((d) => (
                  <li key={d.id} className="rounded-md bg-surface-card px-md py-sm text-body-md text-ink">
                    {d.content}
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          <SurfaceCard className="flex min-h-[132px] flex-1 flex-col p-lg">
            <h2 className="mb-sm shrink-0 text-title-md text-ink">이 회의에서 생성된 후속 업무</h2>
            {generatedLoading ? (
              <Skeleton className="h-20" />
            ) : generatedItems.length === 0 ? (
              <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
                아직 생성된 업무가 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-hairline-soft">
                {generatedItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`${base}/tasks/${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-sm py-sm"
                    >
                      <div className="flex min-w-0 items-center gap-sm">
                        <Avatar
                          name={assigneeIdsOf(item)[0] ? memberName(assigneeIdsOf(item)[0]) : undefined}
                          size={28}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-title-sm text-ink">{item.title}</p>
                          <p className="text-caption font-normal text-muted">
                            {assigneeLabel(assigneeIdsOf(item), memberName)} · {formatDate(item.dueDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-xs">
                        <PriorityBadge priority={item.priority} />
                        <StatusBadge status={item.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </div>

        <div className="thin-scroll flex min-h-0 flex-col gap-md overflow-y-auto pr-xxs lg:col-span-4">
          <SurfaceCard className="p-lg">
            <h2 className="mb-md text-title-md text-ink">참여자</h2>
            {!meeting.participants?.length ? (
              <p className="text-body-sm text-muted">참여자가 지정되지 않았습니다.</p>
            ) : (
              <ul className="space-y-sm">
                {meeting.participants.map((p) => (
                  <li key={p.userId} className="flex items-center gap-sm">
                    <Avatar name={p.name} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-body-sm text-ink">{p.name}</p>
                      <p className="truncate text-caption font-normal text-muted">{p.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-lg">
            <h2 className="mb-sm text-title-md text-ink">이전 회의 미완료 업무</h2>
            <p className="mb-md text-body-sm text-muted">이 회의를 만들 때 연결한 업무입니다.</p>
            {!meeting.carryOverActionItems?.length ? (
              <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
                연결된 이전 업무가 없습니다.
              </p>
            ) : (
              <ul key={carryOverPage.page} className="animate-page-in space-y-xs" {...carryOverPage.swipe}>
                {carryOverPage.visible.map((item) => (
                  <li key={item.actionItemId}>
                    <Link
                      to={`${base}/tasks/${item.actionItemId}`}
                      className="block rounded-md border border-hairline p-sm transition-colors hover:bg-surface-card"
                    >
                      <p className="truncate text-body-sm text-ink">{item.title}</p>
                      <p className="mt-xs flex flex-wrap items-center gap-xxs">
                        <StatusBadge status={item.status} />
                        <PriorityBadge priority={item.priority} />
                        <DueBadge dueDate={item.dueDate} status={item.status} />
                      </p>
                      <p className="mt-xs text-caption font-normal text-muted">
                        담당 {assigneeLabel(assigneeIdsOf(item), memberName)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Pager page={carryOverPage.page} pageCount={carryOverPage.pageCount} onChange={carryOverPage.setPage} />
          </SurfaceCard>

          <SurfaceCard className="p-lg">
            <h2 className="mb-md text-title-md text-ink">회의 정보</h2>
            <dl className="space-y-sm text-body-sm">
              <div className="flex justify-between gap-md">
                <dt className="text-muted">상태</dt>
                <dd>
                  <MeetingStatusBadge status={effectiveStatus} />
                </dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-muted">작성자</dt>
                <dd className="text-ink">{memberName(meeting.createdBy)}</dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-muted">생성일</dt>
                <dd className="text-ink">{formatServerDateTime(meeting.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-muted">수정일</dt>
                <dd className="text-ink">{formatServerDateTime(meeting.updatedAt)}</dd>
              </div>
            </dl>
            <div className="mt-lg border-t border-hairline-soft pt-lg">
              <Button variant="danger" fullWidth onClick={() => setConfirmDelete(true)}>
                회의 삭제
              </Button>
            </div>
          </SurfaceCard>
        </div>
      </div>

      <ConfirmDialog
        open={reanalyzeOpen}
        title="회의록이 바뀌었습니다. 다시 분석할까요?"
        description={
          '바뀐 내용으로 새 초안을 만듭니다. 확정하기 전까지는 기존 후속 업무가 그대로 유지됩니다.\n지금 안 해도, 회의록을 고쳐 저장할 때마다 다시 물어봅니다.'
        }
        confirmLabel="다시 분석"
        cancelLabel="나중에"
        destructive={false}
        onConfirm={() => {
          setReanalyzeOpen(false)
          navigate(`${base}/meetings/${meetingId}/analysis`)
        }}
        onClose={() => {
          setReanalyzeOpen(false)
          toast.success('회의록을 저장했습니다.')
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="회의를 삭제할까요?"
        description={
          '회의록과 결정 사항이 삭제됩니다. 이 회의에서 만들어진 후속 업무는 그대로 남습니다.\n되돌릴 수 없습니다.'
        }
        loading={deleting}
        onConfirm={onDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </FitPage>
  )
}
