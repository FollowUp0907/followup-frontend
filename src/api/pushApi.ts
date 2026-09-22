import { api } from './client'

/*
 * 웹 푸시 구독. 아직 없는 백엔드에서도 로그아웃되지 않도록 표시해 둔다.
 */
const OPTIONAL = { skipAuthLogout: true }

export const subscribePush = (token: string) =>
  api.post<void>('/api/push/subscriptions', { token }, OPTIONAL).then((r) => r.data)

/** 백엔드가 본문으로 토큰을 받는다. axios 는 DELETE 에도 본문을 실어 보낸다. */
export const unsubscribePush = (token: string) =>
  api.delete<void>('/api/push/subscriptions', { ...OPTIONAL, data: { token } }).then((r) => r.data)
