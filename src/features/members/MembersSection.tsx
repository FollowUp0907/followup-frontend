import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { Pager, usePager } from '@/components/ui/Pager'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { AvatarColorPicker } from '@/features/members/AvatarColorPicker'
import { useRemoveMember } from '@/features/members/queries'
import { MemberInviteModal } from '@/features/members/MemberInviteModal'
import { useInvitations, useResendInvitation, useRevokeInvitation } from '@/features/members/invitationQueries'
import { MAX_MEMBERS, isMemberLimitReached } from '@/features/members/limit'
import { useActionItems } from '@/features/actionItems/queries'
import { assigneeIdsOf } from '@/features/actionItems/assignees'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { ROLE_LABEL } from '@/lib/constants'
import { formatServerDate } from '@/lib/date'
import type { InvitationResDto, ProjectMemberResDto } from '@/types/api'

type Row =
  | { kind: 'member'; key: string; member: ProjectMemberResDto }
  | { kind: 'invite'; key: string; invitation: InvitationResDto }

/**
 * 구성원 관리.
 * 예전에는 별도 탭이었는데 설정 안으로 들어왔다. (탭이 다섯 개면 많았다)
 */
export function MembersSection() {
  const { projectId, members, membersLoading, isOwner } = useProjectContext()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const removeMember = useRemoveMember(projectId)
  const { data: actionItems } = useActionItems(projectId)
  const { pending, available: invitesAvailable } = useInvitations(projectId)
  const resendInvitation = useResendInvitation(projectId)
  const revokeInvitation = useRevokeInvitation(projectId)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [target, setTarget] = useState<ProjectMemberResDto | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<InvitationResDto | null>(null)
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  // 수락을 기다리는 초대도 자리를 차지한다.
  const waiting = invitesAvailable ? pending : []

  /*
   * 한 목록에 두 가지가 섞인다 — 이미 들어온 구성원과, 아직 수락을 기다리는 초대.
   * 소유자를 맨 위에, 그 다음 구성원(참여 순), 대기 중인 초대는 맨 뒤에 둔다.
   */
  const rows = useMemo<Row[]>(() => {
    const ordered = [...members].sort((a, b) => Number(b.role === 'OWNER') - Number(a.role === 'OWNER'))
    return [
      ...ordered.map((member): Row => ({ kind: 'member', key: `m${member.userId}`, member })),
      ...waiting.map((invitation): Row => ({ kind: 'invite', key: `i${invitation.id}`, invitation })),
    ]
  }, [members, waiting])

  // 설정 화면이 한 페이지에 들어오도록 3줄씩 끊는다.
  const page = usePager(rows, 3)

  const countFor = (userId: number) => {
    const mine = (actionItems ?? []).filter((i) => assigneeIdsOf(i).includes(userId))
    return {
      total: mine.length,
      done: mine.filter((i) => i.status === 'DONE').length,
    }
  }

  const limitReached = isMemberLimitReached(members.length + waiting.length)

  const resend = async (invitation: InvitationResDto) => {
    setResendingId(invitation.id)
    try {
      await resendInvitation.mutateAsync(invitation.id)
      toast.success(`${invitation.email} 로 초대 메일을 다시 보냈습니다.`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setResendingId(null)
    }
  }

  /** 소유자가 아닌 사람이 스스로 프로젝트에서 빠진다. 맡던 업무는 그대로 남는다. */
  const leave = async () => {
    if (!user?.userId) return
    try {
      await removeMember.mutateAsync(user.userId)
      toast.success('프로젝트에서 나왔습니다.')
      setLeaveOpen(false)
      navigate('/projects', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const revoke = async () => {
    if (!revokeTarget) return
    try {
      await revokeInvitation.mutateAsync(revokeTarget.id)
      toast.success('초대를 취소했습니다.')
      setRevokeTarget(null)
    } catch (e) {
      toast.error(errorMessage(e))
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
              {members.length + waiting.length}/{MAX_MEMBERS}명
            </span>
            <Button onClick={() => setInviteOpen(true)} disabled={limitReached}>
              {invitesAvailable ? '구성원 초대' : '구성원 추가'}
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-sm">
            <Badge tone="neutral">MEMBER 권한</Badge>
            <Button variant="secondary" onClick={() => setLeaveOpen(true)}>
              프로젝트 나가기
            </Button>
          </span>
        )}
      </div>

      {membersLoading && <Skeleton className="h-[200px]" />}

      {!membersLoading && rows.length === 0 && (
        <EmptyState title="구성원이 없습니다" description="이메일로 팀원을 초대해 보세요." />
      )}

      {rows.length > 0 && (
        <SurfaceCard className="overflow-hidden">
          <ul key={page.page} className="animate-page-in divide-y divide-hairline-soft">
            {page.visible.map((row) =>
              row.kind === 'member' ? (
                <li key={row.key} className="flex flex-wrap items-center justify-between gap-md p-lg">
                  <div className="flex min-w-0 items-center gap-sm">
                    <AvatarColorPicker name={row.member.name} size={40} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-xs truncate text-title-sm text-ink">
                        {row.member.name}
                        {row.member.userId === user?.userId && <Badge tone="neutral">나</Badge>}
                      </p>
                      <p className="truncate text-caption font-normal text-muted">{row.member.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-md">
                    <span className="text-caption font-normal text-muted">
                      담당 업무 {countFor(row.member.userId).done}/{countFor(row.member.userId).total}
                    </span>
                    <span className="text-caption font-normal text-muted-soft">
                      참여 {formatServerDate(row.member.joinedAt)}
                    </span>
                    <Badge tone={row.member.role === 'OWNER' ? 'ink' : 'neutral'}>{ROLE_LABEL[row.member.role]}</Badge>
                    {isOwner && row.member.role !== 'OWNER' && (
                      <Button size="sm" variant="ghost" onClick={() => setTarget(row.member)}>
                        제거
                      </Button>
                    )}
                  </div>
                </li>
              ) : (
                /* 아직 수락하지 않은 초대 — 이름을 모르니 이메일만 보여준다. */
                <li key={row.key} className="flex flex-wrap items-center justify-between gap-md p-lg">
                  <div className="flex min-w-0 items-center gap-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border border-dashed border-hairline text-muted-soft">
                      <Mail size={16} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-title-sm text-muted">{row.invitation.email}</p>
                      <p className="truncate text-caption font-normal text-muted-soft">
                        {formatServerDate(row.invitation.invitedAt)} 초대함
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-md">
                    <Badge tone="neutral">수락 대기 중</Badge>
                    {isOwner && (
                      <>
                        {/* 누른 줄만 돌게 한다 — 뮤테이션 상태를 그대로 쓰면 모든 줄이 함께 돈다. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={resendingId === row.invitation.id}
                          disabled={resendingId !== null}
                          onClick={() => void resend(row.invitation)}
                        >
                          재발송
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRevokeTarget(row.invitation)}>
                          취소
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
          <Pager page={page.page} pageCount={page.pageCount} onChange={page.setPage} className="pb-md" />
        </SurfaceCard>
      )}

      <MemberInviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        projectId={projectId}
        members={members}
      />

      <ConfirmDialog
        open={!!target}
        title={`${target?.name ?? ''} 님을 제거할까요?`}
        description="제거해도 이 사람이 담당하던 업무는 남아 있습니다."
        confirmLabel="제거"
        loading={removeMember.isPending}
        onConfirm={remove}
        onClose={() => setTarget(null)}
      />

      <ConfirmDialog
        open={leaveOpen}
        title="이 프로젝트에서 나갈까요?"
        description="나가도 맡던 업무는 그대로 남습니다. 다시 들어오려면 초대를 받아야 합니다."
        confirmLabel="나가기"
        loading={removeMember.isPending}
        onConfirm={leave}
        onClose={() => setLeaveOpen(false)}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title="초대를 취소할까요?"
        description={`${revokeTarget?.email ?? ''} 님이 받은 초대 링크가 더 이상 동작하지 않습니다.`}
        confirmLabel="초대 취소"
        loading={revokeInvitation.isPending}
        onConfirm={revoke}
        onClose={() => setRevokeTarget(null)}
      />
    </section>
  )
}
