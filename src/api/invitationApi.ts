import { api } from './client'
import type { InvitationCreateReqDto, InvitationPreviewResDto, InvitationResDto } from '@/types/api'

/**
 * 구성원 초대.
 *
 * 이메일을 넣으면 그 주소로 초대 메일이 가고, 받은 사람이 메일에서 수락해야 합류한다.
 * FollowUp 계정이 없는 사람도 초대할 수 있다 — 메일에서 가입을 마치면 자동으로 들어온다.
 */
/*
 * 백엔드에 초대가 아직 없으면 401 이 올 수 있다(매핑 안 된 경로).
 * 그걸 세션 만료로 오해해 로그아웃시키지 않도록 표시해 둔다.
 */
const OPTIONAL = { skipAuthLogout: true }

export const listInvitations = (projectId: number) =>
  api.get<InvitationResDto[]>(`/api/project/${projectId}/invitations`, OPTIONAL).then((r) => r.data)

export const createInvitation = (projectId: number, data: InvitationCreateReqDto) =>
  api.post<InvitationResDto>(`/api/project/${projectId}/invitations`, data, OPTIONAL).then((r) => r.data)

export const resendInvitation = (projectId: number, invitationId: number) =>
  api.post<void>(`/api/project/${projectId}/invitations/${invitationId}/resend`, undefined, OPTIONAL).then((r) => r.data)

export const revokeInvitation = (projectId: number, invitationId: number) =>
  api.delete<void>(`/api/project/${projectId}/invitations/${invitationId}`, OPTIONAL).then((r) => r.data)

/** 메일 링크로 들어온 화면에서 "어느 프로젝트인지" 보여주기 위한 조회 (로그인 불필요) */
export const previewInvitation = (token: string) =>
  api.get<InvitationPreviewResDto>(`/api/invitations/${encodeURIComponent(token)}`, OPTIONAL).then((r) => r.data)

/** 수락 — 로그인한 계정의 이메일이 초대받은 주소와 같아야 한다 (검증은 백엔드) */
export const acceptInvitation = (token: string) =>
  api
    .post<InvitationPreviewResDto>(`/api/invitations/${encodeURIComponent(token)}/accept`, undefined, OPTIONAL)
    .then((r) => r.data)
