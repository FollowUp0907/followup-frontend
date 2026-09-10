import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, DueBadge, PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SurfaceCard } from '@/components/ui/Card'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useActionItems } from '@/features/actionItems/queries'
import { useCreateMeeting } from '@/features/meetings/queries'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { useAuth } from '@/features/auth/AuthContext'
import { dayjs, fromDateTimeLocalInput } from '@/lib/date'

const SAMPLE = `로그인 오류는 반서현님이 금요일까지 수정하기로 했다.
배포는 다음 주 월요일에 진행한다.
검색 기능은 이번 버전에서 제외하기로 결정했다.
API 문서는 장은호님이 이번 주 안에 정리한다.`

const schema = z.object({
  title: z.string().min(1, '회의 제목을 입력해 주세요.').max(200, '200자 이하로 입력해 주세요.'),
  scheduledAt: z.string().min(1, '회의 날짜와 시간을 선택해 주세요.'),
  content: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function MeetingNewPage() {
  const { projectId, members } = useProjectContext()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const createMeeting = useCreateMeeting(projectId)
  const { data: allItems } = useActionItems(projectId)

  const openItems = useMemo(
    () => (allItems ?? []).filter((i) => i.status !== 'DONE'),
    [allItems],
  )

  const [participantIds, setParticipantIds] = useState<number[]>(() => (user ? [user.userId] : []))
  const [carryOverIds, setCarryOverIds] = useState<number[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      scheduledAt: dayjs().format('YYYY-MM-DDTHH:mm'),
      content: '',
    },
  })

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) =>
    setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createMeeting.mutateAsync({
        title: values.title,
        scheduledAt: fromDateTimeLocalInput(values.scheduledAt),
        content: values.content?.trim() || undefined,
        participantIds: participantIds.length ? participantIds : undefined,
        carryOverActionItemIds: carryOverIds.length ? carryOverIds : undefined,
      })
      toast.success('회의를 만들었습니다.')
      navigate(`/projects/${projectId}/meetings/${created.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  })

  return (
    <>
      <PageHeader
        title="새 회의"
        description="회의를 만들고 회의록을 작성하면 AI 분석으로 넘어갈 수 있습니다."
        breadcrumb={
          <Link to={`/projects/${projectId}/meetings`} className="text-nav-link text-muted">
            ← 회의 목록
          </Link>
        }
      />

      <form onSubmit={onSubmit} noValidate className="grid gap-lg lg:grid-cols-12">
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
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue('content', SAMPLE)}>
                예시 넣기
              </Button>
            </div>
            <p className="mb-md text-body-sm text-muted">
              형식은 자유입니다. 지금 비워 두고 회의 후에 작성해도 됩니다.
            </p>
            <Textarea
              id="content"
              className="min-h-[280px]"
              placeholder="회의에서 나온 이야기를 그대로 적어 주세요."
              {...register('content')}
            />
          </SurfaceCard>
        </div>

        <div className="space-y-lg lg:col-span-5">
          <SurfaceCard className="p-xl">
            <h2 className="mb-sm text-title-md text-ink">참여자</h2>
            <p className="mb-md text-body-sm text-muted">이 회의에 참여한 구성원을 선택하세요.</p>
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
                      setCarryOverIds(
                        carryOverIds.length === openItems.length ? [] : openItems.map((i) => i.id),
                      )
                    }
                  >
                    {carryOverIds.length === openItems.length ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
                <ul className="space-y-xxs">
                  {openItems.map((item) => (
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
              </>
            )}
          </SurfaceCard>

          <div className="flex justify-end gap-sm">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              취소
            </Button>
            <Button type="submit" loading={createMeeting.isPending}>
              회의 만들기
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
