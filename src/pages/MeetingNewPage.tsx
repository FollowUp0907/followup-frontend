import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Mic, Square, UserPlus } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageWidth } from '@/components/layout/PageWidth'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { Pager, usePager } from '@/components/ui/Pager'
import { Avatar, DueBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SurfaceCard } from '@/components/ui/Card'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useActionItems } from '@/features/actionItems/queries'
import { useCreateMeeting } from '@/features/meetings/queries'
import { useAddMember } from '@/features/members/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { useAuth } from '@/features/auth/AuthContext'
import { dayjs, fromDateTimeLocalInput } from '@/lib/date'
import { stripDraft, useSpeechToText, withDraft } from '@/lib/speech'

const schema = z.object({
  title: z.string().min(1, '회의 제목을 입력해 주세요.').max(200, '200자 이하로 입력해 주세요.'),
  scheduledAt: z.string().min(1, '회의 날짜와 시간을 선택해 주세요.'),
})
type FormValues = z.infer<typeof schema>

export default function MeetingNewPage() {
  const { projectId, members, isOwner } = useProjectContext()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const createMeeting = useCreateMeeting(projectId)
  const { data: allItems } = useActionItems(projectId)

  const openItems = useMemo(() => (allItems ?? []).filter((i) => i.status !== 'DONE'), [allItems])
  // 목록이 길어지면 스크롤 대신 페이지로 넘긴다.
  const carryOverPage = usePager(openItems, 5)

  const [participantIds, setParticipantIds] = useState<number[]>(() => (user ? [user.userId] : []))
  const [carryOverIds, setCarryOverIds] = useState<number[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  // 회의를 만들다가 빠진 사람이 보이면 여기서 바로 추가할 수 있게 한다.
  const addMember = useAddMember(projectId)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      scheduledAt: dayjs().format('YYYY-MM-DDTHH:mm'),
    },
  })

  const contentRef = useRef<HTMLTextAreaElement | null>(null)
  // 확정된 회의록. 받아쓰는 중인 조각은 여기 넣지 않고 화면에만 얹는다.
  const [content, setContent] = useState('')

  // 확정된 문장은 한 줄씩 쌓는다. 회의록은 발화 단위로 끊어 읽는 게 편하다.
  const appendTranscript = useCallback((text: string) => {
    setContent((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${text}` : text))
  }, [])

  const stt = useSpeechToText({
    onText: appendTranscript,
    onError: (message) => toast.error(message),
  })

  // 말하는 중인 조각을 맨 끝에 붙여서 보여 준다. 확정되면 onText 가 본문으로 옮긴다.
  const { tail: draftTail, shown } = withDraft(content, stt.interim)

  // 글자가 늘어나는 동안 항상 마지막 줄이 보이게 따라 내린다.
  useEffect(() => {
    const el = contentRef.current
    if (el && stt.listening) el.scrollTop = el.scrollHeight
  }, [shown, stt.listening])

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) =>
    setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id])

  const invite = async () => {
    const value = inviteEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setInviteError('이메일 형식이 올바르지 않습니다.')
      return
    }
    setInviteError(null)
    try {
      const added = await addMember.mutateAsync(value)
      // 방금 넣은 사람은 이 회의 참여자로도 바로 체크해 둔다.
      if (added?.userId) setParticipantIds((prev) => (prev.includes(added.userId) ? prev : [...prev, added.userId]))
      toast.success('구성원을 추가했습니다.')
      setInviteEmail('')
      setInviteOpen(false)
    } catch (e) {
      setInviteError(errorMessage(e))
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!content.trim()) {
      toast.error('회의록 내용을 채워 주세요. 내용이 있어야 AI 분석을 할 수 있습니다.')
      contentRef.current?.focus()
      return
    }
    setPendingValues(values)
    setConfirmOpen(true)
  })

  const createNow = async () => {
    const values = pendingValues
    if (!values) return
    try {
      const created = await createMeeting.mutateAsync({
        title: values.title,
        scheduledAt: fromDateTimeLocalInput(values.scheduledAt),
        content: content.trim() || undefined,
        participantIds: participantIds.length ? participantIds : undefined,
        carryOverActionItemIds: carryOverIds.length ? carryOverIds : undefined,
      })
      toast.success('회의를 만들었습니다.')
      setConfirmOpen(false)
      navigate(`/projects/${projectId}/meetings/${created.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <PageWidth size={1120}>
      <PageHeader
        title="새 회의"
        description="회의를 만들고 회의록을 작성하면 AI 분석으로 넘어갈 수 있습니다."
        breadcrumb={
          <Link to={`/projects/${projectId}/meetings`} className="text-nav-link text-muted">
            ← 회의 목록
          </Link>
        }
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              취소
            </Button>
            <Button type="submit" form="meeting-create-form" loading={createMeeting.isPending}>
              회의 만들기
            </Button>
          </>
        }
      />

      <form id="meeting-create-form" onSubmit={onSubmit} noValidate className="grid gap-lg lg:grid-cols-12">
        <div className="space-y-lg lg:col-span-7">
          <SurfaceCard className="p-xl">
            <h2 className="mb-lg text-title-md text-ink">기본 정보</h2>
            <div className="space-y-md">
              <FormRow label="회의 제목" htmlFor="title" error={errors.title?.message}>
                <Input id="title" placeholder="9월 2주차 개발 회의" invalid={!!errors.title} {...register('title')} />
              </FormRow>
              <FormRow label="회의 일시" htmlFor="scheduledAt" error={errors.scheduledAt?.message}>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  invalid={!!errors.scheduledAt}
                  {...register('scheduledAt')}
                />
              </FormRow>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-xl">
            <div className="mb-sm flex items-center justify-between gap-md">
              <h2 className="text-title-md text-ink">회의록</h2>
              {stt.supported && (
                <Button
                  type="button"
                  variant={stt.listening ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={stt.listening ? stt.stop : stt.start}
                  aria-pressed={stt.listening}
                >
                  {stt.listening ? (
                    <>
                      <span className="h-2 w-2 animate-pulse rounded-pill bg-error" aria-hidden />
                      <Square size={13} aria-hidden /> 받아쓰기 중지
                    </>
                  ) : (
                    <>
                      <Mic size={14} aria-hidden /> 음성으로 받아쓰기
                    </>
                  )}
                </Button>
              )}
            </div>
            <p className="mb-md text-body-sm text-muted">
              {stt.supported
                ? '직접 적어도 되고, 받아쓰기를 켜고 말해도 됩니다. 지금 비워 두고 회의 후에 작성해도 됩니다.'
                : '형식은 자유입니다. 지금 비워 두고 회의 후에 작성해도 됩니다.'}
            </p>
            <Textarea
              id="content"
              ref={contentRef}
              className="min-h-[280px]"
              placeholder="회의에서 나온 이야기를 그대로 적어 주세요."
              value={shown}
              onChange={(e) => {
                // 받아쓰는 중이면 끝에 붙여 둔 조각은 본문이 아니라 미리보기다. 떼고 저장한다.
                setContent(stripDraft(e.target.value, draftTail))
              }}
            />
            {stt.listening && (
              <p className="mt-xs flex items-center gap-xs text-caption font-normal text-muted" aria-live="polite">
                <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-error" aria-hidden />
                말하는 대로 적히고 있습니다. 문장이 끝나면 줄이 바뀝니다.
              </p>
            )}
          </SurfaceCard>
        </div>

        <div className="space-y-lg lg:col-span-5">
          <SurfaceCard className="p-xl">
            <div className="mb-sm flex items-center justify-between gap-md">
              <h2 className="text-title-md text-ink">참여자</h2>
              <span className="text-caption font-normal text-muted-soft">{participantIds.length}명 선택됨</span>
            </div>
            <p className="mb-sm text-body-sm text-muted">이 회의에 참여한 구성원을 선택하세요.</p>
            <div className="mb-md flex flex-wrap items-center gap-xs">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setParticipantIds(members.map((m) => m.userId))}
                disabled={members.length === 0 || participantIds.length === members.length}
              >
                전체 선택
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setParticipantIds([])}
                disabled={participantIds.length === 0}
              >
                전체 해제
              </Button>
              {isOwner && (
                <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setInviteOpen(true)}>
                  <UserPlus size={14} /> 구성원 추가
                </Button>
              )}
            </div>
            {members.length === 0 ? (
              <p className="text-body-sm text-muted">구성원 정보를 불러오는 중입니다.</p>
            ) : (
              <ul className="space-y-xxs">
                {members.map((m) => (
                  <li key={m.userId}>
                    <label className="flex cursor-pointer items-center gap-sm rounded-md px-xs py-xs transition-colors hover:bg-surface-card">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#111111]"
                        checked={participantIds.includes(m.userId)}
                        onChange={() => toggle(participantIds, setParticipantIds, m.userId)}
                      />
                      <Avatar name={m.name} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm text-ink">{m.name}</span>
                        <span className="block truncate text-caption font-normal text-muted">{m.email}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-xl">
            <h2 className="mb-sm text-title-md text-ink">이전 회의 미완료 업무</h2>
            <p className="mb-md text-body-sm text-muted">
              선택한 업무는 이 회의에 연결되어, 회의 상세에서 진행 상황을 함께 볼 수 있습니다.
            </p>
            {openItems.length === 0 ? (
              <p className="rounded-md bg-surface-soft px-md py-lg text-center text-body-sm text-muted">
                이전 회의의 미완료 업무가 없습니다.
              </p>
            ) : (
              <>
                <div className="mb-sm flex items-center justify-between">
                  <span className="text-caption font-normal text-muted">{carryOverIds.length}건 선택됨</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setCarryOverIds(carryOverIds.length === openItems.length ? [] : openItems.map((i) => i.id))
                    }
                  >
                    {carryOverIds.length === openItems.length ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
                <ul key={carryOverPage.page} className="animate-page-in space-y-xxs" {...carryOverPage.swipe}>
                  {carryOverPage.visible.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-start gap-sm rounded-md border border-hairline px-sm py-sm transition-colors hover:bg-surface-card">
                        <input
                          type="checkbox"
                          className="mt-xxs h-4 w-4 accent-[#111111]"
                          checked={carryOverIds.includes(item.id)}
                          onChange={() => toggle(carryOverIds, setCarryOverIds, item.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm text-ink">{item.title}</span>
                          <span className="mt-xs flex flex-wrap items-center gap-xxs">
                            <StatusBadge status={item.status} />
                            <PriorityBadge priority={item.priority} />
                            <DueBadge dueDate={item.dueDate} status={item.status} />
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <Pager page={carryOverPage.page} pageCount={carryOverPage.pageCount} onChange={carryOverPage.setPage} />
              </>
            )}
          </SurfaceCard>
        </div>
      </form>

      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false)
          setInviteError(null)
        }}
        title="구성원 추가"
        description="이미 FollowUp에 가입한 계정의 이메일을 입력해 주세요. 추가하면 이 회의 참여자로도 바로 선택됩니다."
        width="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              취소
            </Button>
            <Button type="button" onClick={invite} loading={addMember.isPending}>
              추가
            </Button>
          </>
        }
      >
        <FormRow label="이메일" error={inviteError ?? undefined}>
          <Input
            type="email"
            value={inviteEmail}
            placeholder="teammate@example.com"
            invalid={!!inviteError}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void invite()
              }
            }}
          />
        </FormRow>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="이 내용으로 회의를 만들까요?"
        description={
          pendingValues
            ? `"${pendingValues.title}" 회의가 만들어집니다. 만든 뒤에도 회의록은 수정할 수 있습니다.`
            : undefined
        }
        confirmLabel="회의 만들기"
        destructive={false}
        loading={createMeeting.isPending}
        onConfirm={createNow}
        onClose={() => setConfirmOpen(false)}
      />
    </PageWidth>
  )
}
