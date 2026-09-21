import { api, isEndpointMissing } from './client'

/*
 * 내 계정. 백엔드에 아직 없을 수 있어(매핑 안 된 경로에 401 을 준다) 로그아웃을 막아 둔다.
 */
const OPTIONAL = { skipAuthLogout: true }

export interface MeResDto {
  userId?: number
  name?: string
  email?: string
}

/** 이름 변경 */
export const updateMyName = (name: string) =>
  api.patch<MeResDto>('/api/users/me', { name }, OPTIONAL).then((r) => r.data)

/** 회원 탈퇴 — 되돌릴 수 없다. */
export const deleteMyAccount = () => api.delete<void>('/api/users/me', OPTIONAL).then((r) => r.data)

/** 백엔드에 아직 이 API 가 없는가? */
export const accountApiMissing = isEndpointMissing
