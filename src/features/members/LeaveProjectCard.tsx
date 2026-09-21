import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { SurfaceCard } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useRemoveMember } from '@/features/members/queries'

/**
 * 프로젝트 나가기.
 *
 * 소유자에게 "프로젝트 삭제" 가 있는 자리에, 구성원에게는 이것이 놓인다.
 * 나가는 것은 자기 자신을 구성원에서 빼는 것과 같아서 구성원 제거 API 를 그대로 쓴다.
 */
export function LeaveProjectCard({ projectId }: { projectId: number }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const removeMember = useRemoveMember(projectId)
  const [open, setOpen] = useState(false)

  const leave = async () => {
    if (!user?.userId) return
    try {
      await removeMember.mutateAsync(user.userId)
      toast.success('프로젝트에서 나왔습니다.')
      setOpen(false)
      navigate('/projects', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <SurfaceCard className="p-xl">
        <h2 className="text-title-md text-ink">프로젝트 나가기</h2>
        <p className="mt-xs text-body-sm text-muted">
          나가도 맡던 업무는 그대로 남습니다. 다시 들어오려면 초대를 받아야 합니다.
        </p>
        <div className="mt-lg flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            프로젝트 나가기
          </Button>
        </div>
      </SurfaceCard>

      <ConfirmDialog
        open={open}
        title="이 프로젝트에서 나갈까요?"
        description="나가도 맡던 업무는 그대로 남습니다. 다시 들어오려면 초대를 받아야 합니다."
        confirmLabel="나가기"
        loading={removeMember.isPending}
        onConfirm={leave}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
