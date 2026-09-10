import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageWidth } from '@/components/layout/PageWidth'
import { Avatar, DueBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { FormRow, Input, Select, Textarea } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/NavPillGroup'
import { useToast } from '@/components/ui/Toast'
import { useActionItem, useDeleteActionItem, useUpdateActionItem } from '@/features/actionItems/queries'
import { useMeeting } from '@/features/meetings/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from '@/lib/constants'
import { formatDate, formatDateTime, formatServerDateTime, toDateInput } from '@/lib/date'
import type { ActionItemPriority, ActionItemStatus } from '@/types/api'

export default function TaskDetailPage() {
  const { projectId, members } = useProjectContext()
  const params = useParams()
  const actionItemId = Number(params.actionItemId)
  const navigate = useNavigate()
  const toast = useToast()

  const { data: item, isLoading, isError, error } = useActionItem(actionItemId)
  const updateItem = useUpdateActionItem(projectId)
  const deleteItem = useDeleteActionItem(projectId)
  const { data: originMeeting } = useMeeting(item?.originMeetingId ?? 0)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<ActionItemPriority | ''>('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!item) return
    setTitle(item.title)
    setDescription(item.description ?? '')
    setAssigneeUserId(item.assignee?.userId ? String(item.assignee.userId) : '')
    setDueDate(toDateInput(item.dueDate))
    setPriority(item.priority ?? '')
  }, [item])

  const base = `/projects/${projectId}`

  if (isLoading) {
    return (
      <div className="space-y-lg">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-[280px]" />
      </div>
    )
  }

  if (isError || !item) {
    return (
      <EmptyState
        title="업무를 불러오지 못했습니다"
        description={errorMessage(error)}
        action={
          <ButtonLink to={`${base}/tasks`} variant="secondary">
            업무 보드로
          </ButtonLink>
        }
      />
    )
  }

  const changeStatus = async (status: ActionItemStatus) => {
    try {
      await updateItem.mutateAsync({ id: item.id, data: { status } })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const save = async () => {
    if (!title.trim()) {
      toast.error('업무명을 입력해 주세요.')
      return
    }
    // 백엔드가 null 을 "값 지우기" 로 처리하지 않고 무시한다(2026-09-10 확인).
    // 그래서 비우려 한 필드는 따로 기억해 두고, 저장 결과를 보고 사용자에게 알려 준다.
    const clearingAssignee = !assigneeUserId && !!item.assignee
    const clearingDueDate = !dueDate && !!item.dueDate
    try {
      const saved = await updateItem.mutateAsync({
        id: item.id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          assigneeUserId: assigneeUserId ? Number(assigneeUserId) : null,
          dueDate: dueDate || null,
          priority: priority || undefined,
        },
      })
      const kept = [
        clearingAssignee && saved.assignee ? '담당자' : null,
        clearingDueDate && saved.dueDate ? '마감일' : null,
      ].filter(Boolean)
      if (kept.length) {
        toast.error(`${kept.join(' · ')}는 지금 비울 수 없어 이전 값이 유지됐습니다. 나머지는 저장했습니다.`)
      } else {
        toast.success('업무를 수정했습니다.')
      }
      setEditing(false)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const onDelete = async () => {
    try {
      await deleteItem.mutateAsync(item.id)
      toast.success('업무를 삭제했습니다.')
      navigate(`${base}/tasks`, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <PageWidth size={800}>
      <PageHeader
        title={item.title}
        breadcrumb={
          <Link to={`${base}/tasks`} className="text-nav-link text-muted">
            ← 후속 업무
          </Link>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? '편집 취소' : '수정'}
            </Button>
            {editing && (
              <Button onClick={save} loading={updateItem.isPending}>
                저장
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-lg lg:grid-cols-12">
        <div className="space-y-lg lg:col-span-8">
          <SurfaceCard className="p-xl">
            <h2 className="mb-md text-title-md text-ink">업무 내용</h2>
            {editing ? (
              <div className="space-y-md">
                <FormRow label="업무명">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} invalid={!title.trim()} />
                </FormRow>
                <FormRow label="설명" hint="선택">
                  <Textarea
                    className="min-h-[160px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </FormRow>
                <div className="grid gap-md sm:grid-cols-3">
                  <FormRow label="담당자">
                    <Select value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)}>
                      <option value="">미지정</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </FormRow>
                  <FormRow label="마감일">
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </FormRow>
                  <FormRow label="우선순위">
                    <Select value={priority} onChange={(e) => setPriority(e.target.value as ActionItemPriority | '')}>
                      <option value="">미지정</option>
                      {PRIORITY_ORDER.map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </option>
                      ))}
                    </Select>
                  </FormRow>
                </div>
              </div>
            ) : item.description ? (
              <p className="whitespace-pre-wrap rounded-lg bg-surface-card p-lg text-body-md leading-relaxed text-body">
                {item.description}
              </p>
            ) : (
              <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
                설명이 없습니다.
              </p>
            )}
          </SurfaceCard>

          {item.priorityReason && (
            <SurfaceCard className="p-xl">
              <h2 className="mb-sm text-title-md text-ink">AI 추천 이유</h2>
              <p className="rounded-md bg-surface-card px-md py-sm text-body-md text-body">{item.priorityReason}</p>
            </SurfaceCard>
          )}

          <SurfaceCard className="p-xl">
            <h2 className="mb-md text-title-md text-ink">상태 변경</h2>
            <SegmentedControl<ActionItemStatus>
              value={item.status}
              onChange={changeStatus}
              options={STATUS_ORDER.map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
            />
            <p className="mt-sm text-caption font-normal text-muted-soft">
              완료된 업무도 필요하면 다시 진행 중으로 되돌릴 수 있습니다.
            </p>
          </SurfaceCard>
        </div>

        <div className="space-y-lg lg:col-span-4">
          <SurfaceCard className="p-xl">
            <h2 className="mb-md text-title-md text-ink">업무 정보</h2>
            <dl className="space-y-md text-body-sm">
              <div className="flex items-center justify-between gap-md">
                <dt className="text-muted">상태</dt>
                <dd>
                  <StatusBadge status={item.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-md">
                <dt className="text-muted">우선순위</dt>
                <dd>
                  {item.priority ? (
                    <PriorityBadge priority={item.priority} />
                  ) : (
                    <span className="text-ink">미지정</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-md">
                <dt className="text-muted">담당자</dt>
                <dd className="flex items-center gap-xs text-ink">
                  <Avatar name={item.assignee?.name} size={24} />
                  {item.assignee?.name ?? '미지정'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-md">
                <dt className="text-muted">마감일</dt>
                <dd className="flex items-center gap-xs text-ink">
                  {formatDate(item.dueDate)}
                  <DueBadge dueDate={item.dueDate} status={item.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-md">
                <dt className="text-muted">생성일</dt>
                <dd className="text-ink">{formatServerDateTime(item.createdAt)}</dd>
              </div>
              {item.completedAt && (
                <div className="flex items-center justify-between gap-md">
                  <dt className="text-muted">완료일</dt>
                  <dd className="text-ink">{formatServerDateTime(item.completedAt)}</dd>
                </div>
              )}
            </dl>
          </SurfaceCard>

          <SurfaceCard className="p-xl">
            <h2 className="mb-sm text-title-md text-ink">생성된 회의</h2>
            {item.originMeetingId ? (
              <Link
                to={`${base}/meetings/${item.originMeetingId}`}
                className="block rounded-md border border-hairline p-sm transition-colors hover:bg-surface-card"
              >
                <p className="truncate text-body-sm text-ink">
                  {originMeeting?.title ?? `회의 #${item.originMeetingId}`}
                </p>
                {originMeeting && (
                  <p className="mt-xxs text-caption font-normal text-muted">
                    {formatDateTime(originMeeting.scheduledAt)}
                  </p>
                )}
              </Link>
            ) : (
              <p className="text-body-sm text-muted">직접 추가한 업무입니다.</p>
            )}
            <div className="mt-lg border-t border-hairline-soft pt-lg">
              <Button variant="danger" fullWidth onClick={() => setConfirmDelete(true)}>
                업무 삭제
              </Button>
            </div>
          </SurfaceCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="이 업무를 삭제할까요?"
        description="되돌릴 수 없습니다."
        loading={deleteItem.isPending}
        onConfirm={onDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </PageWidth>
  )
}
