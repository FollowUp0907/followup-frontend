import { useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronDown, ChevronsUp, Equal, ExternalLink, GripVertical, Plus, Search, Trash2 } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, DueBadge, PriorityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { Dropdown } from '@/components/ui/Dropdown'
import { MultiDropdown } from '@/components/ui/MultiDropdown'
import { assigneeIdsOf, assigneeLabel, assigneePatch, serverSupportsManyAssignees } from '@/features/actionItems/assignees'
import { Pager, usePager } from '@/components/ui/Pager'
import { RowMenu } from '@/components/ui/RowMenu'
import type { RowMenuItem } from '@/components/ui/RowMenu'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/NavPillGroup'
import { useToast } from '@/components/ui/Toast'
import { TaskDetailDrawer } from '@/features/actionItems/TaskDetailDrawer'
import {
  useActionItems,
  useCreateActionItem,
  useDeleteActionItem,
  useUpdateActionItem,
} from '@/features/actionItems/queries'
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

/**
 * 마감이 임박한 순서. 지난 업무(D+)가 가장 위로 오고, 마감일이 없는 업무는 맨 아래.
 * 보드 컬럼과 목록 뷰가 같은 순서를 쓴다.
 */
function byDueSoonest(a: ActionItemListResDto, b: ActionItemListResDto) {
  if (!a.dueDate && !b.dueDate) return a.id - b.id
  if (!a.dueDate) return 1
  if (!b.dueDate) return -1
  const diff = dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf()
  return diff !== 0 ? diff : a.id - b.id
}

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
  const deleteItem = useDeleteActionItem(projectId)
  const navigate = useNavigate()

  const [createOpen, setCreateOpen] = useState(false)
  // 카드·행을 누르면 오른쪽 패널로 열린다. 톱니 메뉴로만 전체 화면으로 넘어간다.
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ActionItemListResDto | null>(null)
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
    // D-day 가 적게 남은 순. 지난 것(D+)이 맨 위, 마감일 없는 것은 맨 아래.
    return [...items].sort(byDueSoonest)
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

  const openFullPage = (id: number) => navigate(`/projects/${projectId}/tasks/${id}`, { state: { from: listUrl } })

  /** 톱니 메뉴 항목 — 카드와 목록이 같은 것을 쓴다. */
  const menuItems = (item: ActionItemListResDto) => [
    { label: '후속 업무 창 열기', icon: <ExternalLink size={14} />, onSelect: () => openFullPage(item.id) },
    { label: '삭제', icon: <Trash2 size={14} />, destructive: true, onSelect: () => setPendingDelete(item) },
  ]

  const removeItem = async () => {
    if (!pendingDelete) return
    try {
      await deleteItem.mutateAsync(pendingDelete.id)
      if (previewId === pendingDelete.id) setPreviewId(null)
      toast.success('업무를 삭제했습니다.')
      setPendingDelete(null)
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
              memberName={memberName}
              onOpenPreview={setPreviewId}
              menuItems={menuItems}
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
          {/* 가로 스크롤 없이 화면 폭에 맞춘다. 좁아지면 덜 중요한 칸부터 접는다. */}
          <div>
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline text-caption text-muted">
                  <th className="px-md py-sm font-medium">업무명</th>
                  <th className="hidden px-md py-sm font-medium sm:table-cell sm:w-[150px]">담당자</th>
                  <th className="hidden px-md py-sm font-medium lg:table-cell lg:w-[164px]">마감일</th>
                  <th className="hidden px-md py-sm font-medium xl:table-cell xl:w-[96px]">우선순위</th>
                  <th className="w-[150px] px-md py-sm font-medium">상태</th>
                  <th className="w-[44px] px-md py-sm font-medium">
                    <span className="sr-only">메뉴</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setPreviewId(item.id)}
                    className="group cursor-pointer border-b border-hairline-soft transition-colors last:border-0 hover:bg-surface-card"
                  >
                    <td className="px-md py-sm">
                      {/* 행 전체가 눌리지만, 키보드로도 열 수 있게 제목은 버튼으로 둔다 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewId(item.id)
                        }}
                        title={item.title}
                        className="block w-full truncate text-left text-body-sm text-ink hover:underline"
                      >
                        {item.title}
                      </button>
                    </td>
                    <td className="hidden px-md py-sm sm:table-cell">
                      <span className="flex items-center gap-xs text-body-sm text-body">
                        <span className="flex shrink-0 items-center">
                          {(assigneeIdsOf(item).length ? assigneeIdsOf(item) : [0]).slice(0, 3).map((id, i) => (
                            <span
                              key={id || 'none'}
                              className={cn('rounded-pill ring-2 ring-canvas', i > 0 && '-ml-[8px]')}
                            >
                              <Avatar name={id ? memberName(id) : undefined} size={24} />
                            </span>
                          ))}
                        </span>
                        <span className="truncate">{assigneeLabel(assigneeIdsOf(item), memberName)}</span>
                      </span>
                    </td>
                    <td className="hidden px-md py-sm lg:table-cell">
                      <span className="flex items-center gap-xs whitespace-nowrap text-body-sm text-body">
                        {formatDate(item.dueDate)}
                        <DueBadge dueDate={item.dueDate} status={item.status} />
                      </span>
                    </td>
                    <td className="hidden px-md py-sm xl:table-cell">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    {/* 상태 변경은 행 클릭(패널 열기)과 겹치면 안 된다 */}
                    <td className="px-md py-sm" onClick={(e) => e.stopPropagation()}>
                      {/* 위 필터 바와 같은 드롭다운 — 상태 점까지 그대로 */}
                      <Dropdown
                        className="w-full"
                        ariaLabel={`${item.title} 상태`}
                        value={item.status}
                        onChange={(v) => void changeStatus(item, v as ActionItemStatus)}
                        options={STATUS_ORDER.map((st) => ({
                          value: st,
                          label: STATUS_LABEL[st],
                          adornment: (
                            <span
                              className="h-2 w-2 rounded-pill"
                              style={{ background: STATUS_DOT_COLOR[st] }}
                              aria-hidden
                            />
                          ),
                        }))}
                      />
                    </td>
                    <td className="px-md py-sm">
                      <div className="flex justify-end">
                        <RowMenu items={menuItems(item)} label={`${item.title} 메뉴`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      <TaskDetailDrawer
        actionItemId={previewId}
        projectId={projectId}
        backTo={listUrl}
        onClose={() => setPreviewId(null)}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="이 업무를 삭제할까요?"
        description={pendingDelete ? `"${pendingDelete.title}" 이(가) 사라집니다. 되돌릴 수 없습니다.` : undefined}
        confirmLabel="삭제"
        loading={deleteItem.isPending}
        onConfirm={removeItem}
        onClose={() => setPendingDelete(null)}
      />

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
  memberName,
  onOpenPreview,
  menuItems,
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
  memberName: (userId?: number) => string
  onOpenPreview: (id: number) => void
  menuItems: (item: ActionItemListResDto) => RowMenuItem[]
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
              assigneeIds={assigneeIdsOf(item)}
              memberName={memberName}
              menuItems={menuItems(item)}
              onOpen={() => onOpenPreview(item.id)}
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
  assigneeIds,
  memberName,
  menuItems,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  item: ActionItemListResDto
  assigneeIds: number[]
  memberName: (userId?: number) => string
  menuItems: RowMenuItem[]
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
  dragging: boolean
}) {
  const overdue = isOverdue(item.dueDate, item.status)
  const PriorityIcon = item.priority === 'HIGH' ? ChevronsUp : item.priority === 'LOW' ? ChevronDown : Equal

  return (
    // 링크가 아니라 버튼이다. 누르면 오른쪽 패널로 열리고,
    // 전체 화면으로는 점 메뉴를 통해서만 넘어간다.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onOpen()
      }}
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
        'focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ink',
        overdue ? 'border-error/40' : 'border-hairline',
        dragging && 'rotate-[-2deg] scale-[0.98] opacity-35',
      )}
    >
      <GripVertical
        size={14}
        className="absolute left-xxs top-1/2 -translate-y-1/2 text-muted-soft opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />

      {/* 카드 위에 올리면 잘린 제목 전체를 보여 준다 */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-20 max-w-[280px] rounded-md bg-ink px-sm py-xs text-caption font-normal leading-snug text-on-dark opacity-0 shadow-card transition-opacity group-hover:opacity-100"
      >
        {item.title}
      </span>

      <div className="flex items-start justify-between gap-xs">
        {/* 우선순위는 아이콘만, 제목 바로 왼쪽에 */}
        {item.priority && (
          <span
            className="mt-[1px] shrink-0"
            style={{ color: PRIORITY_ICON_COLOR[item.priority] }}
            title={PRIORITY_LABEL[item.priority]}
            aria-label={`우선순위 ${PRIORITY_LABEL[item.priority]}`}
          >
            <PriorityIcon size={16} strokeWidth={3} />
          </span>
        )}
        <p className="min-w-0 flex-1 truncate pt-[1px] text-title-sm leading-snug text-ink">{item.title}</p>
        <RowMenu items={menuItems} label={`${item.title} 메뉴`} />
      </div>

      <div className="flex items-center justify-between gap-xs">
        <div className="flex min-w-0 items-center gap-xs">
          {/* 마감일과 그 오른쪽에 D-day */}
          <span className="flex shrink-0 items-center gap-xxs text-caption font-normal text-muted">
            <CalendarClock size={12} />
            {item.dueDate ? item.dueDate.slice(5) : '미정'}
          </span>
          <DueBadge dueDate={item.dueDate} status={item.status} />
        </div>
        {/* 담당자 — 겹친 아바타 + 이름. 여러 명이면 "OOO 외 N명" */}
        <span className="flex min-w-0 shrink items-center gap-xs">
          <span className="flex shrink-0 items-center">
            {(assigneeIds.length ? assigneeIds : [0]).slice(0, 3).map((id, i) => (
              <span key={id || 'none'} className={cn('rounded-pill ring-2 ring-canvas', i > 0 && '-ml-[8px]')}>
                <Avatar name={id ? memberName(id) : undefined} size={22} />
              </span>
            ))}
          </span>
          <span className="truncate text-caption font-normal text-muted">
            {assigneeLabel(assigneeIds, memberName)}
          </span>
        </span>
      </div>
    </div>
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
  const [assigneeIds, setAssigneeIds] = useState<number[]>([])
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<ActionItemPriority | ''>('MEDIUM')
  const [touched, setTouched] = useState(false)

  const reset = () => {
    setTitle('')
    setDescription('')
    setAssigneeIds([])
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
                ...assigneePatch(assigneeIds),
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
          {/* 위쪽 필터와 같은 드롭다운으로 맞춘다. 업무 상세의 수정 폼도 같다. */}
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
          <FormRow label="마감일">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FormRow>
          <FormRow label="우선순위">
            <Dropdown
              ariaLabel="우선순위"
              value={priority}
              onChange={(v) => setPriority(v as ActionItemPriority | '')}
              placeholder="미지정"
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
      </div>
    </Modal>
  )
}
