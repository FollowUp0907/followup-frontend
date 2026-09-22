import { api } from './client'

/*
 * 웹 푸시 구독. 아직 없는 백엔드에서도 로그아웃되지 않도록 표시해 둔다.
 */
const OPTIONAL = { skipAuthLogout: true }

export const subscribePush = (token: string) =>
  api.post<void>('/api/push/subscriptions', { token }, OPTIONAL).then((r) => r.data)

/*
 * 해제는 DELETE 가 아니라 POST 다.
 * DELETE 의 본문은 중간 프록시가 버리는 경우가 있어(우리는 Vercel 프록시를 거친다)
 * 백엔드와 POST 로 맞췄다. 본문이 사라지면 구독이 안 지워져 로그아웃한 브라우저로
 * 계속 푸시가 간다.
 */
export const unsubscribePush = (token: string) =>
  api.post<void>('/api/push/subscriptions/unsubscribe', { token }, OPTIONAL).then((r) => r.data)
