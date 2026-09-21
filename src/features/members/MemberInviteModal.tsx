import { useState } from 'react'
import { errorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { MAX_MEMBERS, memberLimitMessage } from '@/features/members/limit'
import { useAddMember } from '@/features/members/queries'
import { invitationUnavailable, useInviteMember, useInvitations } from '@/features/members/invitationQueries'
import type { ProjectMemberResDto } from '@/types/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 구성원 초대 창. 설정과 새 회의 양쪽에서 같은 것을 쓴다.
 *
 * 이메일을 넣으면 그 주소로 초대 메일이 가고, 받은 사람이 수락해야 합류한다.
 * FollowUp 계정이 없는 사람도 초대할 수 있다.
 *
 * 백엔드에 초대 API 가 아직 없으면 예전 방식(가입한 계정을 바로 추가)으로 돌아간다.
 * 그래서 배포 순서를 맞추지 않아도 구성원 추가가 막히지 않는다.
 */
export function MemberInviteModal({
  open,
  onClose,
  projectId,
  members,
  note,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  projectId: number
  members: ProjectMemberResDto[]
  /** 화면마다 덧붙일 안내 한 줄 (예: "추가하면 이 회의 참여자로도 선택됩니다") */
  note?: string
  /** 예전 방식으로 바로 추가됐을 때만 실제 구성원이 넘어온다. */
  onAdded?: (member?: ProjectMemberResDto) => void
}) {
  const toast = useToast()
  const { pending, available } = useInvitations(projectId)
  const invite = useInviteMember(projectId)
  const addMember = useAddMember(projectId)

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  // 초대 API 가 있는 줄 알았는데 막상 불러 보니 없던 경우
  const [fellBack, setFellBack] = useState(false)

  const canInvite = available && !fellBack
  // 자리 수는 이미 들어온 사람 + 수락을 기다리는 초대를 함께 센다.
  const used = members.length + (canInvite ? pending.length : 0)
  const limitReached = used >= MAX_MEMBERS

  const close = () => {
    setError(null)
    onClose()
  }

  const submit = async () => {
    if (limitReached) {
      setError(memberLimitMessage)
      return
    }
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setError('이메일 형식이 올바르지 않습니다.')
      return
    }
    setError(null)

    if (canInvite) {
      try {
        await invite.mutateAsync(value)
        toast.success(`${value} 로 초대 메일을 보냈습니다.`)
        setEmail('')
        onAdded?.()
        close()
        return
      } catch (e) {
        if (!invitationUnavailable(e)) {
          setError(errorMessage(e))
          return
        }
        // 초대가 없는 백엔드였다. 아래 예전 방식으로 이어서 시도한다.
        setFellBack(true)
      }
    }

    try {
      const added = await addMember.mutateAsync(value)
      toast.success('구성원을 추가했습니다.')
      setEmail('')
      onAdded?.(added)
      close()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const description = limitReached
    ? memberLimitMessage
    : canInvite
      ? `초대 메일을 보냅니다. 받은 사람이 수락하면 합류합니다. FollowUp 계정이 없어도 괜찮습니다. (${used}/${MAX_MEMBERS}명)`
      : `이미 FollowUp에 가입한 계정의 이메일을 입력해 주세요. (${used}/${MAX_MEMBERS}명)`

  return (
    <Modal
      open={open}
      onClose={close}
      title={canInvite ? '구성원 초대' : '구성원 추가'}
      description={note && !limitReached ? `${description} ${note}` : description}
      width="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close}>
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            loading={invite.isPending || addMember.isPending}
            disabled={limitReached}
          >
            {canInvite ? '초대 메일 보내기' : '추가'}
          </Button>
        </>
      }
    >
      <FormRow label="이메일" error={error ?? undefined}>
        <Input
          type="email"
          value={email}
          placeholder="teammate@example.com"
          invalid={!!error}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
          }}
        />
      </FormRow>
    </Modal>
  )
}
