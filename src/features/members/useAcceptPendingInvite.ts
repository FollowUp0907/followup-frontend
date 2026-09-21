import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import * as invitationApi from '@/api/invitationApi'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { clearPendingInvite, readPendingInvite } from '@/features/members/pendingInvite'
import { qk } from '@/lib/queryKeys'

/**
 * 로그인/가입을 마치고 돌아온 사람이 적어 둔 초대를 자동으로 수락한다.
 *
 * 초대 화면을 거치지 않고 프로젝트 목록으로 떨어지는 경우가 있어서, 목록 화면에서
 * 한 번 확인한다. 수락에 성공하면 그 프로젝트로 바로 들어간다.
 */
export function useAcceptPendingInvite() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  // 한 번만 시도한다. (실패한 초대를 무한히 다시 부르지 않도록)
  const tried = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || tried.current) return
    const token = readPendingInvite()
    if (!token) return
    tried.current = true

    void (async () => {
      try {
        const res = await invitationApi.acceptInvitation(token)
        clearPendingInvite()
        await qc.invalidateQueries({ queryKey: qk.projects })
        if (res?.projectId) {
          await qc.invalidateQueries({ queryKey: qk.members(res.projectId) })
          toast.success(`${res.projectName ?? '프로젝트'} 에 합류했습니다.`)
          navigate(`/projects/${res.projectId}`, { replace: true })
        }
      } catch {
        // 만료·취소·다른 계정 — 초대 화면에서 이유를 보여주는 편이 낫다.
        clearPendingInvite()
      }
    })()
  }, [isAuthenticated, navigate, qc, toast])
}
