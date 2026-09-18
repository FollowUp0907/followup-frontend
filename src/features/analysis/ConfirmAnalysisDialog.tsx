import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, RotateCcw, Trash2 } from 'lucide-react'
import { Avatar, DueBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/date'
import type { ActionItemListResDto, ActionItemPriority } from '@/types/api'

/** 새로 만들어질 업무 한 줄 — AnalysisPage 의 DraftRow 중 화면에 필요한 것만. */
export interface NewTaskPreview {
  key: string
  title: string
  assigneeUserId: number | null
  dueDate: string
  priority: ActionItemPriority | ''
}

/**
 * 확정 직전, 기존 업무와 새로 생길 업무를 좌우로 놓고 고르는 창.
 *
 * 재분석 뒤 확정하면 기존 업무가 남은 채로 새 업무가 또 생겨서 같은 일이 두 벌이 된다.
 * 여기서 양쪽을 보면서 지울 것과 남길 것을 정하고 확정한다.
 *
 * 표시는 "지울 예정" 으로만 해 두고 실제 삭제는 확인을 눌렀을 때 일어난다.
 * 그래서 창을 닫으면 아무 일도 없었던 게 된다.
 */
export function ConfirmAnalysisDialog({
  open,
  onClose,
  existing,
  existingLoading,
  newTasks,
  memberName,
  pending,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  /** 이 회의에서 이미 만들어진 업무 */
  existing: ActionItemListResDto[]
  existingLoading: boolean
  newTasks: NewTaskPreview[]
  memberName: (userId?: number) => string
  pending: boolean
  /** 지울 기존 업무 id 들과, 남길 새 업무 key 들 */
  onConfirm: (removeExistingIds: number[], keepNewKeys: string[]) => void
}) {
  const [removeIds, setRemoveIds] = useState<number[]>([])
  const [dropKeys, setDropKeys] = useState<string[]>([])

  // 창을 열 때마다 처음 상태로 되돌린다.
  useEffect(() => {
    if (open) {
      setRemoveIds([])
      setDropKeys([])
    }
  }, [open])

  const keepNew = useMemo(() => newTasks.filter((t) => !dropKeys.includes(t.key)), [newTasks, dropKeys])
  const keepExisting = existing.length - removeIds.length

  const toggle = <T,>(list: T[], setList: (v: T[]) => void, v: T) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="후속 업무를 만들기 전에 확인해 주세요"
      description="이 회의에서 이미 만든 업무와 이번에 새로 생길 업무입니다. 겹치는 것을 지우고 남길 것만 정하세요."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={() => onConfirm(removeIds, keepNew.map((t) => t.key))}
            loading={pending}
            disabled={keepNew.length === 0 && removeIds.length === 0}
          >
            확인
          </Button>
        </>
      }
    >
      <div className="grid gap-md md:grid-cols-2">
        {/* 왼쪽 — 이미 있는 업무 */}
        <section className="min-w-0">
          <p className="mb-xs flex items-center gap-xs text-caption text-body">
            기존 후속 업무
            <span className="rounded-pill bg-surface-card px-xs py-[1px] tabular-nums text-muted">
              {existing.length}
            </span>
          </p>
          <div className="thin-scroll max-h-[320px] space-y-xxs overflow-y-auto rounded-md bg-surface-soft p-xs">
            {existingLoading && <Skeleton className="h-[64px]" />}
            {!existingLoading && existing.length === 0 && (
              <p className="px-sm py-lg text-center text-caption font-normal text-muted">
                이 회의에서 만든 업무가 없습니다.
              </p>
            )}
            {existing.map((item) => {
              const marked = removeIds.includes(item.id)
              return (
                <article
                  key={item.id}
                  className={cn(
                    'flex items-start gap-xs rounded-md border bg-canvas px-sm py-xs transition-opacity',
                    marked ? 'border-error/40 opacity-50' : 'border-hairline',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-body-sm text-ink', marked && 'line-through')}>{item.title}</p>
                    <div className="mt-xxs flex flex-wrap items-center gap-xxs">
                      <Avatar name={item.assigneeUserId ? memberName(item.assigneeUserId) : undefined} size={18} />
                      <span className="text-caption font-normal text-muted">
                        {item.assigneeUserId ? memberName(item.assigneeUserId) : '미지정'}
                      </span>
                      <StatusBadge status={item.status} />
                      <DueBadge dueDate={item.dueDate} status={item.status} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(removeIds, setRemoveIds, item.id)}
                    aria-label={marked ? `${item.title} 삭제 취소` : `${item.title} 삭제 예정`}
                    className={cn(
                      'mt-xxs inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                      marked ? 'text-muted hover:text-ink' : 'text-muted-soft hover:bg-error/5 hover:text-error',
                    )}
                  >
                    {marked ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                  </button>
                </article>
              )
            })}
          </div>
          <p className="mt-xs text-caption font-normal text-muted-soft">
            {removeIds.length > 0 ? `${removeIds.length}건 삭제 · ${keepExisting}건 유지` : '전부 그대로 둡니다'}
          </p>
        </section>

        {/* 오른쪽 — 이번에 생길 업무 */}
        <section className="min-w-0">
          <p className="mb-xs flex items-center gap-xs text-caption text-body">
            <ArrowRight size={13} className="text-muted-soft" aria-hidden />
            새로 생길 업무
            <span className="rounded-pill bg-surface-card px-xs py-[1px] tabular-nums text-muted">
              {newTasks.length}
            </span>
          </p>
          <div className="thin-scroll max-h-[320px] space-y-xxs overflow-y-auto rounded-md bg-surface-soft p-xs">
            {newTasks.length === 0 && (
              <p className="px-sm py-lg text-center text-caption font-normal text-muted">새로 만들 업무가 없습니다.</p>
            )}
            {newTasks.map((t) => {
              const dropped = dropKeys.includes(t.key)
              return (
                <article
                  key={t.key}
                  className={cn(
                    'flex items-start gap-xs rounded-md border bg-canvas px-sm py-xs transition-opacity',
                    dropped ? 'border-hairline opacity-50' : 'border-hairline',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-body-sm text-ink', dropped && 'line-through')}>{t.title}</p>
                    <div className="mt-xxs flex flex-wrap items-center gap-xxs">
                      <Avatar name={t.assigneeUserId ? memberName(t.assigneeUserId) : undefined} size={18} />
                      <span className="text-caption font-normal text-muted">
                        {t.assigneeUserId ? memberName(t.assigneeUserId) : '미지정'}
                      </span>
                      {t.priority && <PriorityBadge priority={t.priority} />}
                      {t.dueDate && (
                        <span className="text-caption font-normal text-muted">{formatDate(t.dueDate)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(dropKeys, setDropKeys, t.key)}
                    aria-label={dropped ? `${t.title} 다시 포함` : `${t.title} 제외`}
                    className={cn(
                      'mt-xxs inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                      dropped ? 'text-muted hover:text-ink' : 'text-muted-soft hover:bg-surface-card hover:text-ink',
                    )}
                  >
                    {dropped ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                  </button>
                </article>
              )
            })}
          </div>
          <p className="mt-xs text-caption font-normal text-muted-soft">
            {dropKeys.length > 0 ? `${dropKeys.length}건 제외 · ${keepNew.length}건 생성` : `${keepNew.length}건 생성`}
          </p>
        </section>
      </div>

      <p className="mt-md rounded-md bg-surface-card px-md py-sm text-caption font-normal text-body">
        확인을 누르면 기존 업무 <strong className="text-ink">{removeIds.length}건</strong>을 삭제하고, 새 업무{' '}
        <strong className="text-ink">{keepNew.length}건</strong>을 만듭니다.
      </p>
    </Modal>
  )
}
