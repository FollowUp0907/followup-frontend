import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageWidth } from '@/components/layout/PageWidth'
import { Avatar, Badge } from '@/components/ui/Badge'
import { Button, ButtonLink, Spinner } from '@/components/ui/Button'
import { EmptyState, SurfaceCard } from '@/components/ui/Card'
import { Dropdown } from '@/components/ui/Dropdown'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useAnalysis, useConfirmAnalysis, useRequestAnalysis } from '@/features/analysis/queries'
import { ConfirmAnalysisDialog } from '@/features/analysis/ConfirmAnalysisDialog'
import { useActionItems, useDeleteActionItem } from '@/features/actionItems/queries'
import { useActionItemOrigins } from '@/features/actionItems/useActionItemOrigins'
import { useMeeting } from '@/features/meetings/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { PRIORITY_ICON_COLOR, PRIORITY_LABEL, PRIORITY_ORDER } from '@/lib/constants'
import { formatDateTime, toDateInput } from '@/lib/date'
import type { ActionItemPriority, AnalysisResDto } from '@/types/api'

/** 화면에서 편집하는 초안 행 (AI 결과 + 사용자 수정본) */
interface DraftRow {
  key: string
  title: string
  description: string
  assigneeUserId: number | null
  dueDate: string
  priority: ActionItemPriority | ''
  priorityReason: string
  /** AI 가 읽어낸 담당자 이름 — 멤버 매칭에 실패했을 때 안내용으로 보여준다 */
  aiAssigneeName?: string
  matched: boolean
}

let rowSeq = 0
const nextKey = () => `row-${(rowSeq += 1)}`

export default function AnalysisPage() {
  const { projectId, members, memberName, matchMemberByName } = useProjectContext()
  const params = useParams()
  const meetingId = Number(params.meetingId)
  const navigate = useNavigate()
  const toast = useToast()

  const { data: meeting } = useMeeting(meetingId)
  const requestAnalysis = useRequestAnalysis()
  const [analysisId, setAnalysisId] = useState<number | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const { data: analysis } = useAnalysis(analysisId)
  const confirmAnalysis = useConfirmAnalysis(projectId, meetingId)
  const deleteActionItem = useDeleteActionItem(projectId)

  const [decisions, setDecisions] = useState<Array<{ key: string; content: string }>>([])
  const [rows, setRows] = useState<DraftRow[]>([])
  const [hydratedFor, setHydratedFor] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // 확정 직전에만 켠다. 항목마다 상세를 부르는 비싼 조회라서.
  const { data: allItems } = useActionItems(projectId)
  const { originByItemId, isLoading: originsLoading } = useActionItemOrigins(projectId, confirmOpen)
  // 이 회의에서 이미 만들어진 업무 — 재분석하면 이것들과 겹치는 업무가 또 생긴다.
  const existingFromMeeting = useMemo(
    () => (allItems ?? []).filter((i) => originByItemId.get(i.id) === meetingId),
    [allItems, originByItemId, meetingId],
  )
  const requestedRef = useRef(false)

  const base = `/projects/${projectId}`
  const hasContent = !!meeting?.content?.trim()

  const startAnalysis = async () => {
    setRequestError(null)
    try {
      const res = await requestAnalysis.mutateAsync(meetingId)
      setAnalysisId(res.id)
      // 이미 GENERATED 로 돌아온 경우도 폴링 훅이 캐시를 채우도록 그대로 둔다.
    } catch (e) {
      setRequestError(errorMessage(e))
    }
  }

  // 회의록이 있으면 진입 즉시 한 번 분석을 요청한다.
  // (백엔드가 재사용 가능한 분석이 있으면 200 으로 기존 결과를 그대로 돌려준다)
  useEffect(() => {
    if (requestedRef.current || !meeting || !hasContent) return
    requestedRef.current = true
    void startAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, hasContent])

  // GENERATED 결과를 편집 가능한 로컬 상태로 옮긴다. (한 분석당 한 번만)
  useEffect(() => {
    if (!analysis || analysis.status === 'PROCESSING') return
    if (hydratedFor === analysis.id) return

    const draft = analysis.draft
    setDecisions(
      (draft?.decisions ?? []).map((d) => ({
        key: nextKey(),
        content: d.content ?? '',
      })),
    )
    setRows(
      (draft?.actionItems ?? []).map((a) => {
        const matchedMember = matchMemberByName(a.assigneeName)
        return {
          key: nextKey(),
          title: a.title ?? '',
          description: a.description ?? '',
          assigneeUserId: matchedMember?.userId ?? null,
          dueDate: toDateInput(a.dueDate),
          priority: a.priority ?? '',
          priorityReason: a.priorityReason ?? '',
          aiAssigneeName: a.assigneeName,
          matched: !!matchedMember,
        }
      }),
    )
    setHydratedFor(analysis.id)
  }, [analysis, hydratedFor, matchMemberByName])

  const unmatchedCount = useMemo(() => rows.filter((r) => !r.assigneeUserId && r.aiAssigneeName).length, [rows])
  const invalidRows = useMemo(() => rows.filter((r) => !r.title.trim()).length, [rows])

  const patchRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        key: nextKey(),
        title: '',
        description: '',
        assigneeUserId: null,
        dueDate: '',
        priority: 'MEDIUM',
        priorityReason: '',
        matched: true,
      },
    ])

  const onConfirm = async (removeExistingIds: number[], keepNewKeys: string[]) => {
    if (!analysis) return
    try {
      // 겹친다고 표시한 기존 업무를 먼저 치운다. 확정이 실패해도 여기까지는 사용자가 원한 것이다.
      for (const id of removeExistingIds) {
        await deleteActionItem.mutateAsync(id)
      }
      await confirmAnalysis.mutateAsync({
        analysisId: analysis.id,
        data: {
          decisions: decisions
            .map((d) => d.content.trim())
            .filter(Boolean)
            .map((content) => ({ content })),
          actionItems: rows
            .filter((r) => r.title.trim() && keepNewKeys.includes(r.key))
            .map((r) => ({
              title: r.title.trim(),
              description: r.description.trim() || undefined,
              assigneeUserId: r.assigneeUserId ?? undefined,
              dueDate: r.dueDate || undefined,
              priority: r.priority || undefined,
              priorityReason: r.priorityReason.trim() || undefined,
            })),
        },
      })
      toast.success(
        removeExistingIds.length
          ? `기존 업무 ${removeExistingIds.length}건을 지우고 후속 업무를 만들었습니다.`
          : '확정했습니다. 후속 업무가 생성되었습니다.',
      )
      setConfirmOpen(false)
      navigate(`${base}/tasks`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const header = (
    <PageHeader
      title="AI 분석 결과"
      description={meeting ? `${meeting.title} · ${formatDateTime(meeting.scheduledAt)}` : undefined}
      breadcrumb={
        <Link to={`${base}/meetings/${meetingId}`} className="text-nav-link text-muted">
          ← 회의 상세
        </Link>
      }
      actions={analysis ? <StatusChip analysis={analysis} /> : null}
    />
  )

  /* 회의록이 비어 있으면 분석 자체가 불가능 */
  if (meeting && !hasContent) {
    return (
      <>
        {header}
        <EmptyState
          title="회의록이 비어 있습니다"
          description="AI 분석을 요청하려면 먼저 회의록을 작성해야 합니다."
          action={<ButtonLink to={`${base}/meetings/${meetingId}`}>회의록 작성하러 가기</ButtonLink>}
        />
      </>
    )
  }

  if (requestError) {
    return (
      <>
        {header}
        <EmptyState
          title="분석을 요청하지 못했습니다"
          description={requestError}
          action={
            <Button onClick={startAnalysis} loading={requestAnalysis.isPending}>
              다시 시도
            </Button>
          }
        />
      </>
    )
  }

  if (!analysis || analysis.status === 'PROCESSING') {
    return (
      <>
        {header}
        <SurfaceCard className="flex flex-col items-center justify-center gap-md px-lg py-section text-center">
          <Spinner className="h-6 w-6 text-ink" />
          <p className="text-title-md text-ink">회의록을 분석하고 있습니다</p>
          <p className="max-w-md text-body-sm text-muted">
            결정 사항과 후속 업무, 담당자, 마감일을 추출하는 중입니다. 보통 10초 내외가 걸립니다.
          </p>
        </SurfaceCard>
      </>
    )
  }

  if (analysis.status === 'FAILED') {
    return (
      <>
        {header}
        <EmptyState
          title="AI 분석에 실패했습니다"
          description={
            analysis.errorMessage ||
            '회의록 내용을 조금 더 구체적으로 작성한 뒤 다시 시도해 주세요. 기존 회의록은 그대로 남아 있습니다.'
          }
          action={
            <div className="flex gap-sm">
              <ButtonLink to={`${base}/meetings/${meetingId}`} variant="secondary">
                회의록 수정
              </ButtonLink>
              <Button onClick={startAnalysis} loading={requestAnalysis.isPending}>
                다시 분석
              </Button>
            </div>
          }
        />
      </>
    )
  }

  const isConfirmed = analysis.status === 'CONFIRMED'

  return (
    <PageWidth size={1120}>
      {header}

      {isConfirmed && (
        <div className="mb-lg flex flex-wrap items-center justify-between gap-md rounded-lg border border-hairline bg-surface-soft px-lg py-md">
          <p className="text-body-sm text-body">이 분석은 확정되어 후속 업무가 생성되었습니다.</p>
          <ButtonLink to={`${base}/tasks`} size="sm">
            후속 업무 보기
          </ButtonLink>
        </div>
      )}

      {!isConfirmed && (
        <div className="mb-lg rounded-lg bg-surface-card px-lg py-md">
          <p className="text-body-sm text-body">
            아래는 <strong className="text-ink">초안</strong>입니다. 확정하기 전까지는 저장되지 않습니다. 내용을
            수정하거나 항목을 추가·삭제한 뒤 확정해 주세요.
          </p>
          {unmatchedCount > 0 && (
            <p className="mt-xs text-body-sm text-[#b45309]">
              담당자를 찾지 못한 업무가 {unmatchedCount}건 있습니다. 직접 지정해 주세요.
            </p>
          )}
        </div>
      )}

      <div className="space-y-lg">
        {/* 결정 사항 */}
        <SurfaceCard className="p-xl">
          <div className="mb-md flex items-center justify-between gap-md">
            <h2 className="text-title-md text-ink">결정 사항</h2>
            {!isConfirmed && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDecisions((prev) => [...prev, { key: nextKey(), content: '' }])}
              >
                항목 추가
              </Button>
            )}
          </div>

          {decisions.length === 0 ? (
            <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
              추출된 결정 사항이 없습니다.
            </p>
          ) : (
            <ul className="space-y-sm">
              {decisions.map((d, index) => (
                <li key={d.key} className="flex items-start gap-sm">
                  <span className="mt-sm text-caption font-normal tabular-nums text-muted-soft">{index + 1}</span>
                  {isConfirmed ? (
                    <p className="flex-1 rounded-md bg-surface-card px-md py-sm text-body-md text-ink">{d.content}</p>
                  ) : (
                    <>
                      <Textarea
                        className="min-h-[56px] flex-1"
                        value={d.content}
                        placeholder="결정된 내용을 적어 주세요."
                        onChange={(e) =>
                          setDecisions((prev) =>
                            prev.map((item) => (item.key === d.key ? { ...item, content: e.target.value } : item)),
                          )
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-xxs"
                        onClick={() => setDecisions((prev) => prev.filter((item) => item.key !== d.key))}
                      >
                        삭제
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        {/* 후속 업무 */}
        <SurfaceCard className="p-xl">
          <div className="mb-md flex items-center justify-between gap-md">
            <h2 className="text-title-md text-ink">후속 업무</h2>
            {!isConfirmed && (
              <Button size="sm" variant="secondary" onClick={addRow}>
                업무 추가
              </Button>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
              추출된 후속 업무가 없습니다. {!isConfirmed && '필요하면 직접 추가할 수 있습니다.'}
            </p>
          ) : (
            <ul className="space-y-md">
              {rows.map((row, index) => (
                <li key={row.key} className="rounded-lg border border-hairline p-lg">
                  <div className="mb-md flex items-center justify-between gap-sm">
                    <span className="text-caption font-normal text-muted-soft">후속 업무 {index + 1}</span>
                    {!isConfirmed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      >
                        삭제
                      </Button>
                    )}
                  </div>

                  <div className="space-y-md">
                    <FormRow
                      label="업무명"
                      error={!row.title.trim() && !isConfirmed ? '업무명은 비워 둘 수 없습니다.' : undefined}
                    >
                      <Input
                        value={row.title}
                        disabled={isConfirmed}
                        invalid={!row.title.trim()}
                        onChange={(e) => patchRow(row.key, { title: e.target.value })}
                      />
                    </FormRow>

                    <FormRow label="설명" hint="선택">
                      <Textarea
                        className="min-h-[72px]"
                        value={row.description}
                        disabled={isConfirmed}
                        onChange={(e) => patchRow(row.key, { description: e.target.value })}
                      />
                    </FormRow>

                    <div className="grid gap-md sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <FormRow
                        label="담당자"
                        hint={!row.matched && row.aiAssigneeName ? `AI: ${row.aiAssigneeName}` : undefined}
                      >
                        <Dropdown
                          ariaLabel="담당자"
                          value={row.assigneeUserId ? String(row.assigneeUserId) : ''}
                          disabled={isConfirmed}
                          invalid={!row.assigneeUserId && !!row.aiAssigneeName}
                          placeholder="미지정"
                          onChange={(v) =>
                            patchRow(row.key, {
                              assigneeUserId: v ? Number(v) : null,
                              matched: true,
                            })
                          }
                          options={[
                            { value: '', label: '미지정' },
                            ...members.map((m) => ({
                              value: String(m.userId),
                              label: m.name,
                              adornment: <Avatar name={m.name} size={20} />,
                            })),
                          ]}
                        />
                      </FormRow>

                      <FormRow label="마감일">
                        <Input
                          type="date"
                          className="min-w-0"
                          value={row.dueDate}
                          disabled={isConfirmed}
                          onChange={(e) => patchRow(row.key, { dueDate: e.target.value })}
                        />
                      </FormRow>

                      <FormRow label="우선순위">
                        <Dropdown
                          ariaLabel="우선순위"
                          value={row.priority}
                          disabled={isConfirmed}
                          placeholder="미지정"
                          onChange={(v) => patchRow(row.key, { priority: v as ActionItemPriority | '' })}
                          options={[
                            { value: '', label: '미지정' },
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
                      </FormRow>
                    </div>

                    {row.priorityReason && (
                      <div>
                        <span className="mb-xs block text-caption text-body">AI 추천 이유</span>
                        <p className="rounded-md bg-surface-soft px-sm py-xs text-caption font-normal leading-relaxed text-muted">
                          {row.priorityReason}
                        </p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      {/* 확정 액션 — 시안의 사이드 패널을 걷어내고 하단 고정 바로 옮겼다.
          본문이 넓어지고, 스크롤 어디에서든 확정 버튼에 닿는다. */}
      {!isConfirmed && (
        <div className="sticky bottom-0 z-30 -mx-lg mt-lg border-t border-hairline bg-canvas/95 px-lg py-md backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <div className="min-w-0">
              <p className="text-body-sm text-body">
                확정하면 후속 업무 <strong className="text-ink">{rows.filter((r) => r.title.trim()).length}</strong>건과
                결정 사항 <strong className="text-ink">{decisions.filter((d) => d.content.trim()).length}</strong>건이
                저장됩니다.
              </p>
              {invalidRows > 0 && (
                <p className="mt-xxs text-caption font-normal text-error">
                  업무명이 비어 있는 항목 {invalidRows}건은 저장되지 않습니다.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-sm">
              <Button size="lg" onClick={() => setConfirmOpen(true)}>
                확정하고 업무 생성
              </Button>
            </div>
          </div>
          <p className="mt-xs text-caption font-normal text-muted-soft">
            다시 분석하려면 회의 상세에서 회의록을 고친 뒤 <strong className="text-muted">저장</strong> 할 때 나오는 안내에서 다시 분석을 눌러
            주세요.
          </p>
        </div>
      )}

      <ConfirmAnalysisDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        existing={existingFromMeeting}
        existingLoading={originsLoading}
        newTasks={rows
          .filter((r) => r.title.trim())
          .map((r) => ({
            key: r.key,
            title: r.title.trim(),
            assigneeUserId: r.assigneeUserId,
            dueDate: r.dueDate,
            priority: r.priority,
          }))}
        memberName={memberName}
        pending={confirmAnalysis.isPending || deleteActionItem.isPending}
        onConfirm={onConfirm}
      />
    </PageWidth>
  )
}

function StatusChip({ analysis }: { analysis: AnalysisResDto }) {
  if (analysis.status === 'CONFIRMED') return <Badge tone="ink">확정됨</Badge>
  if (analysis.status === 'FAILED') return <Badge tone="error">실패</Badge>
  if (analysis.status === 'PROCESSING') return <Badge tone="info">분석 중</Badge>
  return <Badge tone="neutral">초안</Badge>
}
