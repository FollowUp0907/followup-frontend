import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, DueBadge, PriorityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { FormRow, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/NavPillGroup'
import { useToast } from '@/components/ui/Toast'
import { useActionItems, useCreateActionItem, useUpdateActionItem } from '@/features/actionItems/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { dayjs, formatDate, isDueSoon, isOverdue } from '@/lib/date'
import type { ActionItemListResDto, ActionItemPriority, ActionItemStatus } from '@/types/api'

type ViewMode = 'board' | 'list'

export default function TaskBoardPage() {
  const { projectId, members, memberName } = useProjectContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  const view = (searchParams.get('view') as ViewMode) || 'board'
  const statusFilter = searchParams.get('status') as ActionItemStatus | null
  const priorityFilter = searchParams.get('priority') as ActionItemPriority | null
  const assigneeFilter = searchParams.get('assigneeId')
  const dueFilter = searchParams.get('due')

  // 서버 필터는 담당자/우선순위만 사용하고, 상태·마감 조건은 보드에서 화면 단위로 거른다.
  const serverFilters = {
    assigneeId: assigneeFilter ? Number(assigneeFilter) : undefined,
    priority: priorityFilter ?? undefined,
  }
  const { data, isLoading, isError, error, refetch } = useActionItems(projectId, serverFilters)
  const updateItem = useUpdateActionItem(projectId)
  const createItem = useCreateActionItem(projectId)

  const [createOpen, setCreateOpen] = useState(false)
  const [dragOverColumn, setDragOverColumn] = useState<ActionItemStatus | null>(null)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (!value) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    let items = data ?? []
    if (dueFilter === 'overdue') items = items.filter((i) => isOverdue(i.dueDate, i.status))
    if (dueFilter === 'soon') items = items.filter((i) => isDueSoon(i.dueDate, i.status))
    if (view === 'list' && statusFilter) items = items.filter((i) => i.status === statusFilter)
    return [...items].sort((a, b) => {
      // 마감일이 있는 항목 먼저, 그다음 마감일 순
      if (!a.dueDate && !b.dueDate) return a.id - b.id
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf()
    })
  }, [data, dueFilter, statusFilter, view])

  const byStatus = (status: ActionItemStatus) => filtered.filter((i) => i.status === status)

  const changeStatus = async (item: ActionItemListResDto, status: ActionItemStatus) => {
    if (item.status === status) return
    try {
      await updateItem.mutateAsync({ id: item.id, data: { status } })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const hasActiveFilter = !!(statusFilter || priorityFilter || assigneeFilter || dueFilter)

  return (
    <>
      <PageHeader
        title="후속 업무"
        description="회의에서 확정된 업무와 직접 추가한 업무를 함께 관리합니다."
        actions={
          <>
            <SegmentedControl<ViewMode>
              value={view}
              onChange={(v) => setParam('view', v === 'board' ? null : v)}
              options={[
                { value: 'board', label: '보드' },
                { value: 'list', label: '목록' },
              ]}
            />
            <Button onClick={() => setCreateOpen(true)}>업무 추가</Button>
          </>
        }
      />

      {/* 필터 바 */}
      <SurfaceCard className="mb-lg p-lg">
        <div className="flex flex-wrap items-end gap-md">
          <FormRow label="담당자" className="min-w-[160px] flex-1">
            <Select value={assigneeFilter ?? ''} onChange={(e) => setParam('assigneeId', e.target.value || null)}>
              <option value="">전체</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="우선순위" className="min-w-[140px] flex-1">
            <Select value={priorityFilter ?? ''} onChange={(e) => setParam('priority', e.target.value || null)}>
              <option value="">전체</option>
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="마감" className="min-w-[140px] flex-1">
            <Select value={dueFilter ?? ''} onChange={(e) => setParam('due', e.target.value || null)}>
              <option value="">전체</option>
              <option value="soon">마감 임박</option>
              <option value="overdue">지연</option>
            </Select>
          </FormRow>
          {view === 'list' && (
            <FormRow label="상태" className="min-w-[140px] flex-1">
              <Select value={statusFilter ?? ''} onChange={(e) => setParam('status', e.target.value || null)}>
                <option value="">전체</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </FormRow>
          )}
          {hasActiveFilter && (
            <Button variant="ghost" onClick={() => setSearchParams(view === 'board' ? {} : { view }, { replace: true })}>
              필터 초기화
            </Button>
          )}
        </div>
      </SurfaceCard>

      {isLoading && (
        <div className="grid gap-lg md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[240px]" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          title="후속 업무를 불러오지 못했습니다"
          description={errorMessage(error)}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        />
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          title={hasActiveFilter ? '조건에 맞는 업무가 없습니다' : '아직 후속 업무가 없습니다'}
          description={
            hasActiveFilter
              ? '필터를 바꾸거나 초기화해 보세요.'
              : '회의록을 AI로 분석해 확정하거나, 업무를 직접 추가해 보세요.'
          }
          action={<Button onClick={() => setCreateOpen(true)}>업무 추가</Button>}
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && view === 'board' && (
        <div className="grid gap-lg md:grid-cols-3">
          {STATUS_ORDER.map((status) => {
            const items = byStatus(status)
            return (
              <section
                key={status}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverColumn(status)
                }}
                onDragLeave={() => setDragOverColumn((c) => (c === status ? null : c))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverColumn(null)
                  const id = Number(e.dataTransfer.getData('text/plain'))
                  const item = (data ?? []).find((i) => i.id === id)
                  if (item) void changeStatus(item, status)
                }}
                className={cn(
                  'rounded-lg border border-transparent bg-surface-card p-md transition-colors',
                  dragOverColumn === status && 'border-ink bg-surface-soft',
                )}
              >
                <div className="mb-md flex items-center justify-between px-xs">
                  <h2 className="text-title-sm text-ink">{STATUS_LABEL[status]}</h2>
                  <span className="text-caption font-normal tabular-nums text-muted">{items.length}</span>
                </div>

                <ul className="space-y-sm">
                  {items.map((item) => (
                    <li key={item.id}>
                      <TaskCard
                        item={item}
                        projectId={projectId}
                        assigneeName={memberName(item.assigneeUserId)}
                        onChangeStatus={(s) => changeStatus(item, s)}
                      />
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="rounded-md border border-dashed border-hairline px-sm py-lg text-center text-caption font-normal text-muted-soft">
                      여기로 카드를 끌어다 놓으세요
                    </li>
                  )}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && view === 'list' && (
        <SurfaceCard className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline text-caption text-muted">
                  <th className="px-lg py-sm font-medium">업무명</th>
                  <th className="px-lg py-sm font-medium">담당자</th>
                  <th className="px-lg py-sm font-medium">마감일</th>
                  <th className="px-lg py-sm font-medium">우선순위</th>
                  <th className="px-lg py-sm font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-hairline-soft last:border-0">
                    <td className="px-lg py-sm">
                      <Link to={`/projects/${projectId}/tasks/${item.id}`} className="text-body-sm text-ink hover:underline">
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-lg py-sm">
                      <span className="flex items-center gap-xs text-body-sm text-body">
                        <Avatar name={item.assigneeUserId ? memberName(item.assigneeUserId) : undefined} size={24} />
                        {item.assigneeUserId ? memberName(item.assigneeUserId) : '미지정'}
                      </span>
                    </td>
                    <td className="px-lg py-sm">
                      <span className="flex items-center gap-xs text-body-sm text-body">
                        {formatDate(item.dueDate)}
                        <DueBadge dueDate={item.dueDate} status={item.status} />
                      </span>
                    </td>
                    <td className="px-lg py-sm">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-lg py-sm">
                      <Select
                        className="h-8 w-[120px] text-body-sm"
                        value={item.status}
                        onChange={(e) => changeStatus(item, e.target.value as ActionItemStatus)}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (values) => {
          try {
            await createItem.mutateAsync(values)
            toast.success('업무를 추가했습니다.')
            setCreateOpen(false)
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
        pending={createItem.isPending}
        members={members}
      />
    </>
  )
}

function TaskCard({
  item,
  projectId,
  assigneeName,
  onChangeStatus,
}: {
  item: ActionItemListResDto
  projectId: number
  assigneeName: string
  onChangeStatus: (status: ActionItemStatus) => void
}) {
  const overdue = isOverdue(item.dueDate, item.status)
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(item.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'cursor-grab rounded-lg border bg-canvas p-md shadow-soft transition-shadow active:cursor-grabbing',
        overdue ? 'border-error/40' : 'border-hairline',
      )}
    >
      <Link to={`/projects/${projectId}/tasks/${item.id}`} className="block">
        <p className="text-title-sm text-ink">{item.title}</p>
        <div className="mt-sm flex flex-wrap items-center gap-xxs">
          <PriorityBadge priority={item.priority} />
          <DueBadge dueDate={item.dueDate} status={item.status} />
        </div>
        <div className="mt-sm flex items-center gap-xs">
          <Avatar name={item.assigneeUserId ? assigneeName : undefined} size={24} />
          <span className="truncate text-caption font-normal text-muted">
            {item.assigneeUserId ? assigneeName : '담당자 미지정'}
          </span>
        </div>
      </Link>

      <div className="mt-md border-t border-hairline-soft pt-sm">
        <Select
          className="h-8 text-caption"
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChangeStatus(e.target.value as ActionItemStatus)}
          aria-label="상태 변경"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
    </article>
  )
}

function CreateTaskModal({
  open,
  onClose,
  onSubmit,
  pending,
  members,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: {
    title: string
    description?: string
    assigneeUserId?: number
    dueDate?: string
    priority?: ActionItemPriority
  }) => void
  pending: boolean
  members: Array<{ userId: number; name: string }>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<ActionItemPriority | ''>('MEDIUM')
  const [touched, setTouched] = useState(false)

  const reset = () => {
    setTitle('')
    setDescription('')
    setAssigneeUserId('')
    setDueDate('')
    setPriority('MEDIUM')
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="후속 업무 추가"
      description="AI 분석 없이 직접 업무를 만들 수 있습니다."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            취소
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              setTouched(true)
              if (!title.trim()) return
              onSubmit({
                title: title.trim(),
                description: description.trim() || undefined,
                assigneeUserId: assigneeUserId ? Number(assigneeUserId) : undefined,
                dueDate: dueDate || undefined,
                priority: priority || undefined,
              })
              reset()
            }}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="space-y-md">
        <FormRow label="업무명" error={touched && !title.trim() ? '업무명을 입력해 주세요.' : undefined}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="로그인 오류 수정"
            invalid={touched && !title.trim()}
          />
        </FormRow>
        <FormRow label="설명" hint="선택">
          <Textarea className="min-h-[90px]" value={description} onChange={(e) => setDescription(e.target.value)} />
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
    </Modal>
  )
}
