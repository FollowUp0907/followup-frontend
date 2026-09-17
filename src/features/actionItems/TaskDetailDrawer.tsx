import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { Avatar, DueBadge, PriorityBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/NavPillGroup'
import { useToast } from '@/components/ui/Toast'
import { useActionItem, useUpdateActionItem } from '@/features/actionItems/queries'
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/constants'
import { formatDate, formatServerDateTime } from '@/lib/date'
import type { ActionItemStatus } from '@/types/api'

/**
 * 오른쪽에서 열리는 후속 업무 미리보기.
 *
 * 목록을 떠나지 않고 내용을 확인하고 상태만 바로 바꿀 수 있다.
 * 제목·설명·담당자 같은 걸 고치려면 아래 "전체 화면에서 열기" 로 넘어간다.
 * (톱니 메뉴의 "후속 업무 창 열기" 와 같은 곳이다)
 */
export function TaskDetailDrawer({
  actionItemId,
  projectId,
  backTo,
  onClose,
}: {
  /** null 이면 닫힌 상태 */
  actionItemId: number | null
  projectId: number
  backTo: string
  onClose: () => void
}) {
  const open = actionItemId !== null
  const { data: item, isLoading, isError, error } = useActionItem(actionItemId ?? 0)
  const updateItem = useUpdateActionItem(projectId)
  const toast = useToast()

  const changeStatus = async (status: ActionItemStatus) => {
    if (!item || item.status === status) return
    try {
      await updateItem.mutateAsync({ id: item.id, data: { status } })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item?.title ?? '후속 업무'}
      footer={
        item && (
          <>
            <ButtonLink
              to={`/projects/${projectId}/tasks/${item.id}`}
              state={{ from: backTo }}
              size="sm"
              fullWidth
              className="min-w-0"
            >
              <ExternalLink size={14} /> 전체 화면에서 열기
            </ButtonLink>
            <Button size="sm" variant="secondary" className="shrink-0" onClick={onClose}>
              닫기
            </Button>
          </>
        )
      }
    >
      {isLoading && (
        <div className="space-y-md">
          <Skeleton className="h-8" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[90px]" />
        </div>
      )}

      {isError && <p className="text-body-sm text-error">{errorMessage(error)}</p>}

      {item && (
        <div className="space-y-lg">
          <div>
            <p className="mb-xs text-caption text-body">상태</p>
            <SegmentedControl<ActionItemStatus>
              value={item.status}
              onChange={(v) => void changeStatus(v)}
              options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>

          <dl className="space-y-sm text-body-sm">
            <div className="flex items-center justify-between gap-md">
              <dt className="text-muted">담당자</dt>
              <dd className="flex min-w-0 items-center gap-xs text-ink">
                <Avatar name={item.assignee?.name} size={22} />
                <span className="truncate">{item.assignee?.name ?? '미지정'}</span>
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
              <dt className="text-muted">우선순위</dt>
              <dd className="text-ink">{item.priority ? <PriorityBadge priority={item.priority} /> : '미지정'}</dd>
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

          <div>
            <p className="mb-xs text-caption text-body">설명</p>
            {item.description ? (
              <p className="whitespace-pre-wrap rounded-md bg-surface-card p-md leading-relaxed text-body-sm text-body">
                {item.description}
              </p>
            ) : (
              <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
                설명이 없습니다.
              </p>
            )}
          </div>

          {item.priorityReason && (
            <div>
              <p className="mb-xs text-caption text-body">AI 추천 이유</p>
              <p className="rounded-md bg-surface-card px-md py-sm text-body-sm text-body">{item.priorityReason}</p>
            </div>
          )}

          {item.originMeetingId && (
            <div>
              <p className="mb-xs text-caption text-body">생성된 회의</p>
              {item.originMeetingDeleted ? (
                <div className="rounded-md border border-hairline bg-surface-soft p-sm">
                  <p className="truncate text-body-sm text-muted">
                    {item.originMeetingTitle ?? `회의 #${item.originMeetingId}`}
                  </p>
                  <p className="mt-xxs text-caption font-normal text-muted-soft">삭제된 회의입니다.</p>
                </div>
              ) : (
                <Link
                  to={`/projects/${projectId}/meetings/${item.originMeetingId}`}
                  className="block truncate rounded-md border border-hairline px-sm py-sm text-body-sm text-ink transition-colors hover:bg-surface-card"
                >
                  {item.originMeetingTitle ?? `회의 #${item.originMeetingId}`}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
