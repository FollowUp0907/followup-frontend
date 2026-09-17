import { useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronDown, ChevronsUp, Equal, GripVertical, Plus, Search } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, DueBadge, PriorityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { Dropdown } from '@/components/ui/Dropdown'
import { Pager, usePager } from '@/components/ui/Pager'
import { FormRow, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/NavPillGroup'
import { useToast } from '@/components/ui/Toast'
import { useActionItems, useCreateActionItem, useUpdateActionItem } from '@/features/actionItems/queries'
import { useActionItemOrigins } from '@/features/actionItems/useActionItemOrigins'
import { useMeetings } from '@/features/meetings/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import {
  PRIORITY_ICON_COLOR,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_DOT_COLOR,
  STATUS_LABEL,
  STATUS_ORDER,
} from '@/lib/constants'
import { cn } from '@/lib/cn'
import { dayjs, formatDate, formatDateTime, isDueSoon, isOverdue } from '@/lib/date'
import type { ActionItemListResDto, ActionItemPriority, ActionItemStatus } from '@/types/api'

type ViewMode = 'board' | 'list'

export default function TaskBoardPage() {
  const { projectId, members, memberName } = useProjectContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  // 상세로 들어갔다가 돌아올 때 지금 보고 있던 필터·뷰를 그대로 복원하기 위해 넘긴다.
  const listUrl = `/projects/${projectId}/tasks${searchParams.toString() ? `?${searchParams}` : ''}`

  const view = (searchParams.get('view') as ViewMode) || 'board'
  const statusFilter = searchParams.get('status') as ActionItemStatus | null
  const priorityFilter = searchParams.get('priority') as ActionItemPriority | null
  const assigneeFilter = searchParams.get('assigneeId')
  const dueFilter = searchParams.get('due')
  const meetingFilter = searchParams.get('meetingId')

  // 서버 필터는 담당자/우선순위만 사용하고, 상태·마감 조건은 보드에서 화면 단위로 거른다.
  const serverFilters = {
    assigneeId: assigneeFilter ? Number(assigneeFilter) : undefined,
    priority: priorityFilter ?? undefined,
  }
  const { data, isLoading, isError, error, refetch } = useActionItems(projectId, serverFilters)
  const { data: meetings } = useMeetings(projectId)
  // 회의별 필터는 항목마다 상세를 조회해야 해서(목록 DTO 에 originMeetingId 없음)
  // 실제로 필터를 걸었을 때만 켠다.
  const { originByItemId, isLoading: originsLoading } = useActionItemOrigins(projectId, !!meetingFilter)
  const updateItem = useUpdateActionItem(projectId)
  const createItem = useCreateActionItem(projectId)

  const [createOpen, setCreateOpen] = useState(false)
  const [dragOverColumn, setDragOverColumn] = useState<ActionItemStatus | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  // dragenter/dragleave 는 자식 위를 지날 때마다 번갈아 발생해서 그대로 쓰면 깜빡인다.
  // 컬럼별로 enter 횟수를 세서 0 이 될 때만 해제한다.
  const dragDepth = useRef(new Map<ActionItemStatus, number>())

  const endDrag = () => {
    setDraggingId(null)
    setDragOverColumn(null)
    dragDepth.current.clear()
  }

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
    const keyword = query.trim().toLowerCase()
    if (keyword) items = items.filter((i) => i.title.toLowerCase().includes(keyword))
    if (meetingFilter) {
      const target = Number(meetingFilter)
      items = items.filter((i) => originByItemId.get(i.id) === target)
    }
    return [...items].sort((a, b) => {
      // 마감일이 있는 항목 먼저, 그다음 마감일 순
      if (!a.dueDate && !b.dueDate) return a.id - b.id
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf()
    })
  }, [data, dueFilter, statusFilter, view, meetingFilter, originByItemId, query])

  const byStatus = (status: ActionItemStatus) => filtered.filter((i) => i.status === status)

  const changeStatus = async (item: ActionItemListResDto, status: ActionItemStatus) => {
    if (item.status === status) return
    try {
      await updateItem.mutateAsync({ id: item.id, data: { status } })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const hasActiveFilter = !!(
    statusFilter ||
    priorityFilter ||
    assigneeFilter ||
    dueFilter ||
    meetingFilter ||
    query.trim()
  )

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
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> 업무 추가
            </Button>
          </>
        }
      />

      {/* 업무명 검색 — 백엔드에 검색 파라미터가 없어 받아 온 목록에서 거른다 */}
      <div className="relative mb-md">
        <Search size={16} className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          className="pl-xl"
          placeholder="업무명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="업무명 검색"
        />
      </div>

      {/* 필터 바 — 칸 너비를 그리드로 통일해 길이가 어긋나지 않게 한다 */}
      <SurfaceCard className="mb-lg p-lg">
        <div
          className={cn(
            'grid grid-cols-1 gap-md sm:grid-cols-2',
            // 목록 뷰는 상태 필터가 하나 더 붙어서 5칸 — 한 줄에 들어가도록 칸을 좁힌다.
            view === 'list' ? 'lg:grid-cols-5 lg:gap-sm' : 'lg:grid-cols-4',
          )}
        >
          <FilterField label="회의">
            {(id) => (
              <Dropdown
                ariaLabelledBy={id}
                value={meetingFilter ?? ''}
                onChange={(v) => setParam('meetingId', v || null)}
                options={[
                  { value: '', label: '전체' },
                  ...(meetings ?? []).map((m) => ({
                    value: String(m.id),
                    label: m.title,
                    description: formatDateTime(m.scheduledAt),
                  })),
                ]}
              />
            )}
          </FilterField>

          <FilterField label="담당자">
            {(id) => (
              <Dropdown
                ariaLabelledBy={id}
                value={assigneeFilter ?? ''}
                onChange={(v) => setParam('assigneeId', v || null)}
                options={[
                  { value: '', label: '전체' },
                  ...members.map((m) => ({
                    value: String(m.userId),
                    label: m.name,
                    adornment: <Avatar name={m.name} size={20} />,
                  })),
                ]}
              />
            )}
          </FilterField>

          <FilterField label="우선순위">
            {(id) => (
              <Dropdown
                ariaLabelledBy={id}
                value={priorityFilter ?? ''}
                onChange={(v) => setParam('priority', v || null)}
                options={[
                  { value: '', label: '전체' },
                  ...PRIORITY_ORDER.map((pr) => ({
                    value: pr,
                    label: PRIORITY_LABEL[pr],
                    adornment: (
                      <span
                        className="h-2 w-2 rounded-pill"
                        style={{ background: PRIORITY_ICON_COLOR[pr] }}
                        aria-hidden
                      />
                    ),
                  })),
                ]}
              />
            )}
          </FilterField>

          <FilterField label="마감">
            {(id) => (
              <Dropdown
                ariaLabelledBy={id}
                value={dueFilter ?? ''}
                onChange={(v) => setParam('due', v || null)}
                options={[
                  { value: '', label: '전체' },
                  { value: 'soon', label: '마감 임박' },
                  { value: 'overdue', label: '지연' },
                ]}
              />
            )}
          </FilterField>

          {view === 'list' && (
            <FilterField label="상태">
              {(id) => (
                <Dropdown
                  ariaLabelledBy={id}
                  value={statusFilter ?? ''}
                  onChange={(v) => setParam('status', v || null)}
                  options={[
                    { value: '', label: '전체' },
                    ...STATUS_ORDER.map((st) => ({
                      value: st,
                      label: STATUS_LABEL[st],
                      adornment: (
                        <span
                          className="h-2 w-2 rounded-pill"
                          style={{ background: STATUS_DOT_COLOR[st] }}
                          aria-hidden
                        />
                      ),
                    })),
                  ]}
                />
              )}
            </FilterField>
          )}
        </div>

        {hasActiveFilter && (
          <div className="mt-md flex items-center gap-sm border-t border-hairline-soft pt-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchParams(view === 'board' ? {} : { view }, { replace: true })}
            >
              필터 초기화
            </Button>
            {meetingFilter && originsLoading && (
              <span className="text-caption font-normal text-muted-soft">회의별 업무를 불러오는 중…</span>
            )}
          </div>
        )}
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
          {STATUS_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              items={byStatus(status)}
              projectId={projectId}
              listUrl={listUrl}
              memberName={memberName}
              draggingId={draggingId}
              isDropTarget={
                dragOverColumn === status &&
                !!(draggingId ? (data ?? []).find((i) => i.id === draggingId) : undefined) &&
                (draggingId ? (data ?? []).find((i) => i.id === draggingId)!.status : status) !== status
              }
              onDragEnter={() => {
                const depth = (dragDepth.current.get(status) ?? 0) + 1
                dragDepth.current.set(status, depth)
                setDragOverColumn(status)
              }}
              onDragLeave={() => {
                const depth = (dragDepth.current.get(status) ?? 1) - 1
                dragDepth.current.set(status, depth)
                if (depth <= 0) setDragOverColumn((c) => (c === status ? null : c))
              }}
              onDropItem={(id) => {
                const item = (data ?? []).find((i) => i.id === id)
                endDrag()
                if (item) void changeStatus(item, status)
              }}
              onCardDragStart={setDraggingId}
              onCardDragEnd={endDrag}
            />
          ))}
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
                      <Link
                        to={`/projects/${projectId}/tasks/${item.id}`}
                        state={{ from: listUrl }}
                        className="text-body-sm text-ink hover:underline"
                      >
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

/** 라벨 + 커스텀 드롭다운을 aria-labelledby 로 묶는 필터 한 칸 */
function FilterField({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <span id={id} className="mb-xs block text-caption text-body">
        {label}
      </span>
      {children(id)}
    </div>
  )
}

/** 컬럼 하나. 5개씩 끊어 보여 주고 화살표·스와이프·인디케이터로 넘긴다. */
function BoardColumn({
  status,
  items,
  projectId,
  listUrl,
  memberName,
  draggingId,
  isDropTarget,
  onDragEnter,
  onDragLeave,
  onDropItem,
  onCardDragStart,
  onCardDragEnd,
}: {
  status: ActionItemStatus
  items: ActionItemListResDto[]
  projectId: number
  listUrl: string
  memberName: (userId?: number) => string
  draggingId: number | null
  isDropTarget: boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onDropItem: (id: number) => void
  onCardDragStart: (id: number) => void
  onCardDragEnd: () => void
}) {
  const pager = usePager(items, 5)

  return (
    <section
      onDragEnter={(e) => {
        e.preventDefault()
        onDragEnter()
      }}
      onDragOver={(e) => {
        // preventDefault 를 해야 drop 이 허용된다. 커서도 move 로 고정.
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        onDropItem(Number(e.dataTransfer.getData('text/plain')))
      }}
      className={cn(
        // cn 은 단순 join 이라 상충하는 유틸을 같이 주면 안 된다. 배경은 한쪽에서만 지정.
        'flex flex-col rounded-lg p-sm transition-[background-color,box-shadow] duration-150',
        isDropTarget ? 'bg-surface-card ring-[1.5px] ring-inset ring-ink' : 'bg-surface-soft',
      )}
    >
      <div className="flex items-center gap-xs px-xs pb-md pt-xs">
        <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: STATUS_DOT_COLOR[status] }} aria-hidden />
        <h2 className="text-title-sm text-ink">{STATUS_LABEL[status]}</h2>
        <span className="ml-auto rounded-pill bg-canvas px-xs py-[1px] text-caption tabular-nums text-muted">
          {items.length}
        </span>
      </div>

      <ul key={pager.page} className="flex-1 animate-page-in space-y-sm" {...pager.swipe}>
        {pager.visible.map((item) => (
          <li key={item.id}>
            <TaskCard
              item={item}
              projectId={projectId}
              backTo={listUrl}
              assigneeName={memberName(item.assigneeUserId)}
              dragging={draggingId === item.id}
              onDragStart={() => onCardDragStart(item.id)}
              onDragEnd={onCardDragEnd}
            />
          </li>
        ))}
        {isDropTarget && (
          <li
            aria-hidden
            className="h-[86px] animate-slot-in rounded-md border-[1.5px] border-dashed border-ink/40 bg-ink/[0.04]"
          />
        )}
        {items.length === 0 && !isDropTarget && (
          <li className="rounded-md border border-dashed border-surface-strong px-sm py-lg text-center text-caption font-normal text-muted-soft">
            업무 없음
          </li>
        )}
      </ul>

      <Pager page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />
    </section>
  )
}

function TaskCard({
  item,
  projectId,
  backTo,
  assigneeName,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  item: ActionItemListResDto
  projectId: number
  backTo: string
  assigneeName: string
  onDragStart: () => void
  onDragEnd: () => void
  dragging: boolean
}) {
  const overdue = isOverdue(item.dueDate, item.status)
  const PriorityIcon = item.priority === 'HIGH' ? ChevronsUp : item.priority === 'LOW' ? ChevronDown : Equal

  return (
    <Link
      to={`/projects/${projectId}/tasks/${item.id}`}
      state={{ from: backTo }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(item.id))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        // 제목이 한 줄이라 높이가 같지만, 배지 유무로 어긋나지 않게 최소 높이를 고정한다.
        'group relative flex h-[86px] flex-col justify-between cursor-grab rounded-md border bg-canvas px-md py-sm shadow-soft',
        'transition-[box-shadow,opacity,transform] hover:shadow-card active:cursor-grabbing',
        overdue ? 'border-error/40' : 'border-hairline',
        dragging && 'rotate-[-2deg] scale-[0.98] opacity-35',
      )}
    >
      <GripVertical
        size={14}
        className="absolute right-sm top-sm text-muted-soft opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />

      {/* 카드 위에 올리면 잘린 제목 전체를 보여 준다 */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-20 max-w-[280px] rounded-md bg-ink px-sm py-xs text-caption font-normal leading-snug text-on-dark opacity-0 shadow-card transition-opacity group-hover:opacity-100"
      >
        {item.title}
      </span>

      {/* 좌측 상단 상태 인디케이터 — 예정 회색 / 진행 중 파랑 / 완료 초록 */}
      <span
        className="absolute left-md top-md h-2.5 w-2.5 rounded-pill"
        style={{ background: STATUS_DOT_COLOR[item.status] }}
        aria-label={STATUS_LABEL[item.status]}
      />

      <div className="mb-sm flex items-center justify-between gap-xs pl-md pr-lg">
        {/* 한 줄로 자르고, 카드에 올리면 제목 전체가 말풍선으로 뜬다 */}
        <p className="min-w-0 truncate text-title-sm leading-snug text-ink">{item.title}</p>
        <DueBadge dueDate={item.dueDate} status={item.status} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-sm">
          {item.priority && (
            <span
              className="inline-flex items-center gap-xxs rounded-pill px-xs py-[2px] text-caption font-semibold"
              style={{
                color: PRIORITY_ICON_COLOR[item.priority],
                background: `${PRIORITY_ICON_COLOR[item.priority]}1a`,
              }}
            >
              <PriorityIcon size={14} strokeWidth={2.75} />
              {PRIORITY_LABEL[item.priority]}
            </span>
          )}
          <span
            className={cn('flex items-center gap-xxs text-caption font-normal', overdue ? 'text-error' : 'text-muted')}
          >
            <CalendarClock size={12} />
            {item.dueDate ? item.dueDate.slice(5) : '미정'}
          </span>
        </div>
        {/* 올리면 아이콘 왼쪽으로 이름이 펼쳐진다 */}
        <span className="group/assignee relative flex shrink-0 items-center">
          <span
            className="pointer-events-none absolute right-[calc(100%+6px)] whitespace-nowrap rounded-sm bg-ink px-xs py-[2px] text-caption font-normal text-on-dark opacity-0 transition-opacity group-hover/assignee:opacity-100"
            role="tooltip"
          >
            {item.assigneeUserId ? assigneeName : '담당자 미지정'}
          </span>
          <Avatar name={item.assigneeUserId ? assigneeName : undefined} size={24} />
        </span>
      </div>
    </Link>
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
