import { useMemo, useState } from 'react'
import { errorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { Pager, usePager } from '@/components/ui/Pager'
import { FormRow, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { AvatarColorPicker } from '@/features/members/AvatarColorPicker'
import { useAddMember, useRemoveMember } from '@/features/members/queries'
import { MAX_MEMBERS, isMemberLimitReached, memberLimitMessage } from '@/features/members/limit'
import { useActionItems } from '@/features/actionItems/queries'
import { assigneeIdsOf } from '@/features/actionItems/assignees'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { ROLE_LABEL } from '@/lib/constants'
import { formatServerDate } from '@/lib/date'
import type { ProjectMemberResDto } from '@/types/api'

/**
 * 구성원 관리.
 * 예전에는 별도 탭이었는데 설정 안으로 들어왔다. (탭이 다섯 개면 많았다)
 */
export function MembersSection() {
  const { projectId, members, membersLoading, isOwner } = useProjectContext()
  const { user } = useAuth()
  const toast = useToast()
  const addMember = useAddMember(projectId)
  const removeMember = useRemoveMember(projectId)
  const { data: actionItems } = useActionItems(projectId)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [target, setTarget] = useState<ProjectMemberResDto | null>(null)

  // 소유자를 맨 위에 두고, 나머지는 원래 순서(참여 순)를 지킨다.
  const ordered = useMemo(
    () => [...members].sort((a, b) => Number(b.role === 'OWNER') - Number(a.role === 'OWNER')),
    [members],
  )
  // 설정 화면이 한 페이지에 들어오도록 3명씩 끊는다.
  const page = usePager(ordered, 3)

  const countFor = (userId: number) => {
    const mine = (actionItems ?? []).filter((i) => assigneeIdsOf(i).includes(userId))
    return {
      total: mine.length,
      done: mine.filter((i) => i.status === 'DONE').length,
    }
  }

  const limitReached = isMemberLimitReached(members.length)

  const invite = async () => {
    if (limitReached) {
      setEmailError(memberLimitMessage)
      return
    }
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('이메일 형식이 올바르지 않습니다.')
      return
    }
    setEmailError(null)
    try {
      await addMember.mutateAsync(value)
      toast.success('구성원을 추가했습니다.')
      setEmail('')
      setInviteOpen(false)
    } catch (e) {
      setEmailError(errorMessage(e))
    }
  }

  const remove = async () => {
    if (!target) return
    try {
      await removeMember.mutateAsync(target.userId)
      toast.success('구성원을 제거했습니다.')
      setTarget(null)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <section>
      <div className="mb-md flex flex-wrap items-center justify-between gap-md">
        <div>
          <h2 className="text-title-md text-ink">구성원</h2>
          <p className="mt-xxs text-body-sm text-muted">
            프로젝트를 만든 사람은 OWNER, 초대된 사람은 MEMBER 권한을 갖습니다.
          </p>
        </div>
        {isOwner ? (
          <span className="flex items-center gap-sm">
            <span className="text-caption font-normal text-muted-soft">
              {members.length}/{MAX_MEMBERS}명
            </span>
            <Button onClick={() => setInviteOpen(true)} disabled={limitReached}>
              구성원 추가
            </Button>
          </span>
        ) : (
          <Badge tone="neutral">MEMBER 권한</Badge>
        )}
      </div>

      {membersLoading && <Skeleton className="h-[200px]" />}

      {!membersLoading && members.length === 0 && (
        <EmptyState title="구성원이 없습니다" description="이메일로 팀원을 추가해 보세요." />
      )}

      {members.length > 0 && (
        <SurfaceCard className="overflow-hidden">
          <ul key={page.page} className="animate-page-in divide-y divide-hairline-soft">
            {page.visible.map((m) => {
              const stats = countFor(m.userId)
              return (
                <li key={m.userId} className="flex flex-wrap items-center justify-between gap-md p-lg">
                  <div className="flex min-w-0 items-center gap-sm">
                    <AvatarColorPicker name={m.name} size={40} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-xs truncate text-title-sm text-ink">
                        {m.name}
                        {m.userId === user?.userId && <Badge tone="neutral">나</Badge>}
                      </p>
                      <p className="truncate text-caption font-normal text-muted">{m.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-md">
                    <span className="text-caption font-normal text-muted">
                      담당 업무 {stats.done}/{stats.total}
                    </span>
                    <span className="text-caption font-normal text-muted-soft">
                      참여 {formatServerDate(m.joinedAt)}
                    </span>
                    <Badge tone={m.role === 'OWNER' ? 'ink' : 'neutral'}>{ROLE_LABEL[m.role]}</Badge>
                    {isOwner && m.role !== 'OWNER' && (
                      <Button size="sm" variant="ghost" onClick={() => setTarget(m)}>
                        제거
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <Pager page={page.page} pageCount={page.pageCount} onChange={page.setPage} className="pb-md" />
        </SurfaceCard>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false)
          setEmailError(null)
        }}
        title="구성원 추가"
        description={
          limitReached
            ? memberLimitMessage
            : `이미 FollowUp에 가입한 계정의 이메일을 입력해 주세요. (${members.length}/${MAX_MEMBERS}명)`
        }
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              취소
            </Button>
            <Button onClick={invite} loading={addMember.isPending} disabled={limitReached}>
              추가
            </Button>
          </>
        }
      >
        <FormRow label="이메일" error={emailError ?? undefined}>
          <Input
            type="email"
            value={email}
            placeholder="teammate@example.com"
            invalid={!!emailError}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void invite()
            }}
          />
        </FormRow>
      </Modal>

      <ConfirmDialog
        open={!!target}
        title={`${target?.name ?? ''} 님을 제거할까요?`}
        description="제거해도 이 사람이 담당하던 업무는 남아 있습니다."
        confirmLabel="제거"
        loading={removeMember.isPending}
        onConfirm={remove}
        onClose={() => setTarget(null)}
      />
    </section>
  )
}
