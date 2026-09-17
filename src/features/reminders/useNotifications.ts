import { useMemo } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import * as actionItemApi from '@/api/actionItemApi'
import * as notificationApi from '@/api/notificationApi'
import { qk } from '@/lib/queryKeys'
import { isOverdue } from '@/lib/date'
import * as projectApi from '@/api/projectApi'
import type { NotificationResDto } from '@/types/api'

/**
 * 알림 — 전부 자동 생성이다. 사용자가 손으로 거는 예약은 없다.
 *
 * 종류
 *   OVERDUE       내가 담당인 업무의 마감일이 지남 — 해결될 때까지 계속 보인다
 *   TASK_CREATED  나에게 업무가 배정됨
 *   TASK_UPDATED  내가 담당인 업무가 수정됨
 *   TASK_COMPLETED 내가 담당인 업무가 완료 처리됨
 *
 * 지금 상태
 *   - OVERDUE 는 **프론트에서 직접 계산**한다. 내 업무와 마감일만 있으면 알 수 있고,
 *     "상시" 성격이라 읽음 처리도 필요 없다. (해결되면 저절로 사라진다)
 *   - 나머지 3종은 "누가 무엇을 했다" 는 사건이라 서버만 알 수 있다.
 *     백엔드가 type 을 실어 주기 시작하면 그대로 목록에 섞여 보인다.
 *     (BACKEND_NOTES "알림 2차 요청" 참고)
 */

export type NotificationKind = 'OVERDUE' | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_COMPLETED' | 'REMINDER'

export interface AppNotification {
  /** 서버 알림은 숫자 id, 프론트가 만든 지연 알림은 "overdue-<taskId>" */
  key: string
  kind: NotificationKind
  projectId: number
  actionItemId: number
  taskTitle: string
  /** 목록에 보여 줄 시각 (지연은 마감일) */
  at: string
  read: boolean
  /** 서버가 준 알림만 가진다. 읽음/삭제에 쓴다. */
  serverId?: number
}

const POLL_MS = 30_000

function kindOf(n: NotificationResDto): NotificationKind {
  const t = (n as NotificationResDto & { type?: string }).type
  if (t === 'TASK_CREATED' || t === 'TASK_UPDATED' || t === 'TASK_COMPLETED' || t === 'OVERDUE') return t
  return 'REMINDER'
}

export function useNotifications(userId?: number) {
  const qc = useQueryClient()
  const enabled = !!userId

  // 1) 서버가 만들어 준 알림
  const { data: server } = useQuery({
    queryKey: qk.notifications,
    queryFn: () => notificationApi.listNotifications(),
    enabled,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })

  // 2) 내가 담당인 지연 업무 — 프론트에서 계산한다
  const { data: projects } = useQuery({
    queryKey: qk.projects,
    queryFn: projectApi.listProjects,
    enabled,
    staleTime: 60_000,
  })

  const itemQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: qk.actionItems(p.id),
      queryFn: () => actionItemApi.listActionItems(p.id),
      enabled,
      refetchInterval: POLL_MS,
    })),
  })

  const overdue = useMemo<AppNotification[]>(() => {
    if (!userId) return []
    return itemQueries
      .flatMap((q) => q.data ?? [])
      .filter((i) => i.assigneeUserId === userId && isOverdue(i.dueDate, i.status))
      .map((i) => ({
        key: `overdue-${i.id}`,
        kind: 'OVERDUE' as const,
        projectId: i.projectId,
        actionItemId: i.id,
        taskTitle: i.title,
        at: i.dueDate ?? '',
        // 지연은 해결될 때까지 계속 보여야 하므로 읽음 처리를 두지 않는다.
        read: false,
      }))
      .sort((a, b) => a.at.localeCompare(b.at))
  }, [itemQueries, userId])

  const fromServer = useMemo<AppNotification[]>(
    () =>
      (server ?? []).map((n) => ({
        key: String(n.id),
        kind: kindOf(n),
        projectId: n.projectId,
        actionItemId: n.actionItemId,
        taskTitle: n.taskTitle,
        at: n.remindAt,
        read: !!n.readAt,
        serverId: n.id,
      })),
    [server],
  )

  const invalidate = () => void qc.invalidateQueries({ queryKey: qk.notifications })
  const readMutation = useMutation({
    mutationFn: (id: number) => notificationApi.readNotification(id),
    onSuccess: invalidate,
  })
  const readAllMutation = useMutation({
    mutationFn: () => notificationApi.readAllNotifications(),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationApi.deleteNotification(id),
    onSuccess: invalidate,
  })

  // 지연을 먼저, 그다음 서버 알림을 최신순으로
  const all = useMemo(
    () => [...overdue, ...fromServer.sort((a, b) => b.at.localeCompare(a.at))],
    [overdue, fromServer],
  )
  const unreadCount = all.filter((n) => !n.read).length

  return {
    all,
    unreadCount,
    markRead: (n: AppNotification) => (n.serverId ? readMutation.mutateAsync(n.serverId) : Promise.resolve()),
    markAllRead: () => readAllMutation.mutateAsync(),
    remove: (n: AppNotification) => (n.serverId ? deleteMutation.mutateAsync(n.serverId) : Promise.resolve()),
  }
}

export const KIND_LABEL: Record<NotificationKind, string> = {
  OVERDUE: '마감일이 지났습니다',
  TASK_CREATED: '새 업무가 배정되었습니다',
  TASK_UPDATED: '담당 업무가 수정되었습니다',
  TASK_COMPLETED: '담당 업무가 완료 처리되었습니다',
  REMINDER: '설정한 알림',
}
