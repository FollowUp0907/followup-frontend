import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as invitationApi from '@/api/invitationApi'
import { ApiError } from '@/api/client'
import { qk } from '@/lib/queryKeys'
import type { InvitationResDto } from '@/types/api'

/*
 * 백엔드에 초대 API 가 아직 없을 때 돌아오는 상태들.
 * 우리 백엔드(Spring Security)는 매핑 안 된 경로에 401 을 주기도 해서 같이 본다.
 * (코드가 붙은 401 은 진짜 권한 문제이므로 제외)
 */
function looksMissing(e: unknown) {
  if (!(e instanceof ApiError)) return false
  if (e.status === 404 || e.status === 405 || e.status === 501) return true
  return (e.status === 401 || e.status === 403) && !e.code
}

/**
 * 보낸 초대 목록.
 *
 * 백엔드에 아직 초대가 없으면 `available: false` 로 알려 준다. 그 경우 화면은
 * 예전처럼 "가입한 계정을 바로 추가" 하는 방식으로 돌아간다 — 배포 순서를 맞추지
 * 않아도 구성원 추가가 막히지 않도록.
 */
export function useInvitations(projectId: number) {
  const query = useQuery({
    queryKey: qk.invitations(projectId),
    queryFn: () => invitationApi.listInvitations(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
    retry: false,
    staleTime: 30_000,
  })

  const unavailable = looksMissing(query.error)
  const pending: InvitationResDto[] = (query.data ?? []).filter((i) => i.status === 'PENDING')

  return { ...query, pending, available: !unavailable }
}

export function useInviteMember(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => invitationApi.createInvitation(projectId, { email }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invitations(projectId) })
      qc.invalidateQueries({ queryKey: qk.members(projectId) })
    },
  })
}

export function useResendInvitation(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: number) => invitationApi.resendInvitation(projectId, invitationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invitations(projectId) }),
  })
}

export function useRevokeInvitation(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: number) => invitationApi.revokeInvitation(projectId, invitationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invitations(projectId) }),
  })
}

export const invitationUnavailable = looksMissing
