import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Pencil } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { Avatar, DueBadge, PriorityBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Dropdown } from '@/components/ui/Dropdown'
import { MultiDropdown } from '@/components/ui/MultiDropdown'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/NavPillGroup'
import { useToast } from '@/components/ui/Toast'
import { useActionItem, useUpdateActionItem } from '@/features/actionItems/queries'
import {
  assigneeIdsOf,
  assigneePatch,
  noteAssigneeSupport,
  serverSupportsManyAssignees,
} from '@/features/actionItems/assignees'
import { useProjectContext } from '@/features/projects/ProjectContext'
import {
  PRIORITY_ICON_COLOR,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
} from '@/lib/constants'
import { formatDate, formatServerDateTime, toDateInput } from '@/lib/date'
import type { ActionItemPriority, ActionItemStatus } from '@/types/api'

/**
 * 오른쪽에서 열리는 후속 업무 패널.
 *
 * 목록을 떠나지 않고 내용을 보고, 상태를 바꾸고, 수정까지 할 수 있다.
 * 전체 화면은 아래 "전체 화면에서 열기" — 점 메뉴의 "후속 업무 창 열기" 와 같은 곳이다.
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
  // 닫히는 동안에도 내용이 그대로 보이도록 마지막으로 열었던 업무를 붙들고 있는다.
  const [heldId, setHeldId] = useState<number | null>(actionItemId)
  useEffect(() => {
    if (actionItemId !== null) setHeldId(actionItemId)
  }, [actionItemId])

  const { members, memberName } = useProjectContext()
  const { data: item, isLoading, isError, error } = useActionItem(heldId ?? 0)
  const updateItem = useUpdateActionItem(projectId)
  const toast = useToast()

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<number[]>([])
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<ActionItemPriority | ''>('')

  // 다른 업무를 열면 수정 중이던 건 접는다.
  useEffect(() => {
    setEditing(false)
  }, [heldId, open])

  const startEdit = () => {
    if (!item) return
    setTitle(item.title)
    setDescription(item.description ?? '')
    noteAssigneeSupport(item)
    setAssigneeIds(assigneeIdsOf(item))
    setDueDate(toDateInput(item.dueDate))
    setPriority(item.priority ?? '')
    setEditing(true)
  }

  const changeStatus = async (status: ActionItemStatus) => {
    if (!item || item.status === status) return
    try {
      await updateItem.mutateAsync({ id: item.id, data: { status } })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const save = async () => {
    if (!item) return
    if (!title.trim()) {
      toast.error('업무명을 입력해 주세요.')
      return
    }
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          ...assigneePatch(assigneeIds),
          dueDate: dueDate || null,
          priority: priority || undefined,
        },
      })
      toast.success('업무를 수정했습니다.')
      setEditing(false)
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
        item &&
        (editing ? (
          <>
            <Button size="sm" fullWidth className="min-w-0" onClick={save} loading={updateItem.isPending}>
              저장
            </Button>
            <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => setEditing(false)}>
              취소
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={startEdit}>
              <Pencil size={14} /> 수정
            </Button>
            <ButtonLink
              to={`/projects/${projectId}/tasks/${item.id}`}
              state={{ from: backTo }}
              size="sm"
              fullWidth
              className="min-w-0"
            >
              <ExternalLink size={14} /> 전체 화면에서 열기
            </ButtonLink>
          </>
        ))
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

      {item && editing && (
        <div className="space-y-md">
          <FormRow label="업무명">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} invalid={!title.trim()} />
          </FormRow>
          <FormRow label="설명" hint="선택">
            <Textarea
              className="min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormRow>
          <FormRow
            label="담당자"
            hint={assigneeIds.length > 1 && !serverSupportsManyAssignees() ? '첫 번째만 저장됨' : undefined}
          >
            <MultiDropdown
              ariaLabel="담당자"
              values={assigneeIds}
              onChange={setAssigneeIds}
              options={members.map((m) => ({
                value: m.userId,
                label: m.name,
                adornment: <Avatar name={m.name} size={20} />,
              }))}
              footer={
                assigneeIds.length > 1 && !serverSupportsManyAssignees() ? (
                  <p className="border-t border-hairline-soft px-sm py-xs text-caption font-normal text-muted-soft">
                    서버가 아직 담당자 한 명만 받습니다. 지금은 첫 번째만 저장됩니다.
                  </p>
                ) : null
              }
            />
          </FormRow>
          <FormRow label="마감일" hint={dueDate ? undefined : '없음'}>
            <div className="flex items-center gap-xs">
              <Input
                type="date"
                className="min-w-0 flex-1"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {/* 날짜 입력은 브라우저마다 비우기가 까다로워서 버튼을 따로 둔다. */}
              {dueDate && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => setDueDate('')}
                >
                  지우기
                </Button>
              )}
            </div>
          </FormRow>
          <FormRow label="우선순위">
            <Dropdown
              ariaLabel="우선순위"
              value={priority}
              onChange={(v) => setPriority(v as ActionItemPriority | '')}
              options={[
                { value: '', label: '미지정' },
                ...PRIORITY_ORDER.map((p) => ({
                  value: p,
                  label: PRIORITY_LABEL[p],
                  adornment: (
                    <span className="h-2 w-2 rounded-pill" style={{ background: PRIORITY_ICON_COLOR[p] }} aria-hidden />
                  ),
                })),
              ]}
            />
          </FormRow>
        </div>
      )}

      {item && !editing && (
        // 패널 높이에 맞춰 들어간다. 메타 줄은 고정이고, 설명만 남는 공간을 먹는다.
        <div className="flex h-full min-h-0 flex-col gap-md">
          <div>
            <p className="mb-xs text-caption text-body">상태</p>
            <SegmentedControl<ActionItemStatus>
              value={item.status}
              onChange={(v) => void changeStatus(v)}
              options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>

          <dl className="shrink-0 space-y-xs text-body-sm">
            <div className="flex items-start justify-between gap-md">
              <dt className="pt-xxs text-muted">담당자</dt>
              <dd className="min-w-0 text-ink">
                {assigneeIdsOf(item).length === 0 ? (
                  <span className="flex items-center gap-xs">
                    <Avatar size={22} />
                    미지정
                  </span>
                ) : (
                  // 여러 명이면 한 줄에 한 명씩 — 카드에서는 "외 N명" 으로 접히니 여기서 펼쳐 준다.
                  <ul className="space-y-xxs">
                    {assigneeIdsOf(item).map((id) => (
                      <li key={id} className="flex items-center justify-end gap-xs">
                        <Avatar name={memberName(id)} size={22} />
                        <span className="truncate">{memberName(id)}</span>
                      </li>
                    ))}
                  </ul>
                )}
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

          {/*
            설명만 남는 높이를 먹고, 길면 안에서만 스크롤한다. 패널 전체는 안 움직인다.
            min-h 를 안 주면 창이 낮을 때 이 상자가 0 으로 찌부러지고 글자만 비어져 나온다.
          */}
          <div className="flex min-h-[92px] flex-1 flex-col">
            <p className="mb-xs shrink-0 text-caption text-body">설명</p>
            {item.description ? (
              <p className="thin-scroll min-h-[64px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-md bg-surface-card p-md leading-relaxed text-body-sm text-body">
                {item.description}
              </p>
            ) : (
              <p className="shrink-0 rounded-md bg-surface-soft px-md py-md text-center text-body-sm text-muted">
                설명이 없습니다.
              </p>
            )}
          </div>

          {item.priorityReason && (
            <div className="shrink-0">
              <p className="mb-xs text-caption text-body">AI 추천 이유</p>
              <p className="line-clamp-2 rounded-md bg-surface-card px-md py-sm text-body-sm text-body">
                {item.priorityReason}
              </p>
            </div>
          )}

          {item.originMeetingId && (
            <div className="shrink-0">
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
