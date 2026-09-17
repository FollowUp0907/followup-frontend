import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as notificationApi from '@/api/notificationApi'
import { qk } from '@/lib/queryKeys'
import type { NotificationResDto } from '@/types/api'

/**
 * 후속 업무 알림.
 *
 * 2026-09-17 백엔드 API 로 옮겼다. (그 전에는 localStorage 였다)
 * 전달 방식은 폴링이라 화면이 주기적으로 목록을 다시 받아 온다.
 *  - 서버가 밀어 주지는 않으므로, 앱이 열려 있어야 배지가 갱신된다
 *  - 다만 저장은 서버라서 다른 기기·다른 브라우저에서도 같은 알림이 보인다
 *
 * remindAt 은 보낸 값이 그대로 돌아오는 naive 시각이라 UTC 변환을 하지 않는다.
 * (scheduledAt 과 같은 규칙)
 */

const POLL_MS = 30_000

export type Reminder = NotificationResDto

export function isDue(r: Reminder, now = Date.now()) {
  return new Date(r.remindAt).getTime() <= now
}

export function useReminders(userId?: number) {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: qk.notifications,
    queryFn: () => notificationApi.listNotifications(),
    enabled: !!userId,
    // 서버가 깨워 주지 않으므로 주기적으로 다시 받아 온다.
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.notifications })
  }, [qc])

  const setMutation = useMutation({
    mutationFn: ({ actionItemId, remindAt }: { actionItemId: number; remindAt: string }) =>
      notificationApi.setNotification(actionItemId, remindAt),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationApi.deleteNotification(id),
    onSuccess: invalidate,
  })
  const readMutation = useMutation({
    mutationFn: (id: number) => notificationApi.readNotification(id),
    onSuccess: invalidate,
  })
  const readAllMutation = useMutation({
    mutationFn: () => notificationApi.readAllNotifications(),
    onSuccess: invalidate,
  })

  const all = useMemo(() => data ?? [], [data])
  const due = useMemo(() => all.filter((r) => isDue(r)).sort((a, b) => b.remindAt.localeCompare(a.remindAt)), [all])
  const scheduled = useMemo(
    () => all.filter((r) => !isDue(r)).sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
    [all],
  )
  const unreadCount = due.filter((r) => !r.readAt).length

  return {
    due,
    scheduled,
    unreadCount,
    /** 업무당 1건. 이미 있으면 백엔드가 덮어쓴다. */
    upsert: (actionItemId: number, remindAt: string) => setMutation.mutateAsync({ actionItemId, remindAt }),
    remove: (id: number) => deleteMutation.mutateAsync(id),
    markRead: (id: number) => readMutation.mutateAsync(id),
    markAllRead: () => readAllMutation.mutateAsync(),
    forTask: (actionItemId: number) => all.find((r) => r.actionItemId === actionItemId),
    isSaving: setMutation.isPending || deleteMutation.isPending,
  }
}
