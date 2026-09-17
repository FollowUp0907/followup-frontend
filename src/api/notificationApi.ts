import { api } from './client'
import type { NotificationResDto } from '@/types/api'

/**
 * 알림은 전부 서버가 자동으로 만든다. 프론트에서 거는 예약은 없앴다.
 * (BACKEND_NOTES "알림 3차 (최종) 요청" 참고)
 */

/** 내 알림 전체. due 를 주면 서버가 도착분만 걸러 준다. */
export const listNotifications = (due?: boolean) =>
  api
    .get<NotificationResDto[]>('/api/notifications', { params: due === undefined ? undefined : { due } })
    .then((r) => r.data)

export const deleteNotification = (id: number) => api.delete<void>(`/api/notification/${id}`).then((r) => r.data)

export const readNotification = (id: number) =>
  api.patch<NotificationResDto>(`/api/notification/${id}/read`).then((r) => r.data)

export const readAllNotifications = () => api.patch<void>('/api/notifications/read-all').then((r) => r.data)
