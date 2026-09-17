import { api } from './client'
import type { NotificationResDto } from '@/types/api'

/** 내 알림 전체. due 를 주면 서버가 도착분만 걸러 준다. */
export const listNotifications = (due?: boolean) =>
  api
    .get<NotificationResDto[]>('/api/notifications', { params: due === undefined ? undefined : { due } })
    .then((r) => r.data)

/** 업무당 1건. 이미 있으면 백엔드가 덮어쓴다. */
export const setNotification = (actionItemId: number, remindAt: string) =>
  api.post<NotificationResDto>(`/api/action-item/${actionItemId}/notification`, { remindAt }).then((r) => r.data)

export const deleteNotification = (id: number) => api.delete<void>(`/api/notification/${id}`).then((r) => r.data)

export const readNotification = (id: number) =>
  api.patch<NotificationResDto>(`/api/notification/${id}/read`).then((r) => r.data)

export const readAllNotifications = () => api.patch<void>('/api/notifications/read-all').then((r) => r.data)
