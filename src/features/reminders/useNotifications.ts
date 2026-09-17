import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import * as actionItemApi from '@/api/actionItemApi'
import * as notificationApi from '@/api/notificationApi'
import { qk } from '@/lib/queryKeys'
import { dayjs, daysUntil } from '@/lib/date'
import * as projectApi from '@/api/projectApi'
import type { NotificationResDto } from '@/types/api'

/**
 * 알림 — 전부 자동 생성이다. 사용자가 손으로 거는 예약은 없다.
 *
 * 종류
 *   DUE_SOON      마감이 D-7 안으로 들어옴 — 하루에 한 번
 *   OVERDUE       내가 담당인 업무의 마감일이 지남 — 해결될 때까지 계속 보인다
 *   TASK_CREATED  나에게 업무가 배정됨
 *   TASK_UPDATED  내가 담당인 업무가 수정됨
 *   TASK_COMPLETED 내가 담당인 업무가 완료 처리됨
 *
 * 지금 상태
 *   - DUE_SOON / OVERDUE 는 **프론트에서 직접 계산**한다. 내 업무와 마감일만 있으면
 *     알 수 있어서 서버를 기다릴 필요가 없다. 업무를 끝내거나 마감을 미루면 사라진다.
 *   - 나머지 3종은 "누가 무엇을 했다" 는 사건이라 서버만 알 수 있다.
 *     백엔드가 type 을 실어 주기 시작하면 그대로 목록에 섞여 보인다.
 *     (BACKEND_NOTES "알림 3차 (최종) 요청" 참고)
 */

/** 마감 예고를 시작하는 날. D-7 부터 매일 한 번씩 알린다. */
export const DUE_SOON_NOTICE_DAYS = 7

export type NotificationKind =
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'UNKNOWN'

export interface AppNotification {
  /** 서버 알림은 숫자 id, 프론트가 만든 지연 알림은 "overdue-<taskId>" */
  key: string
  kind: NotificationKind
  projectId: number
  actionItemId: number
  taskTitle: string
  /** 목록에 보여 줄 시각 (마감 예고·지연은 마감일) */
  at: string
  read: boolean
  /** 있으면 D-3 / D+2 같은 뱃지를 붙인다. */
  dueDate?: string
  /** 서버가 준 알림만 가진다. 읽음/삭제에 쓴다. */
  serverId?: number
}

/**
 * 마감 예고를 "하루 한 번" 으로 만드는 장치.
 *
 * 키에 날짜가 들어 있어서 자정이 지나면 **저절로 새 키**가 된다.
 * 그래서 오늘 읽고 넘겨도 내일 다시 뜬다. 따로 만료 처리를 하지 않아도 된다.
 * 이 브라우저에만 저장한다 — 서버가 만든 알림이 아니라 화면이 계산한 것이라
 * 기기마다 따로 읽어도 문제가 없다.
 */
const LOCAL_READ_KEY = 'followup.notifications.read'

function loadLocalRead(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_READ_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function saveLocalRead(keys: string[]) {
  // 키 끝의 날짜로 지난 것을 떨군다. 안 그러면 계속 쌓인다.
  const cutoff = dayjs().subtract(2, 'day').format('YYYY-MM-DD')
  const kept = keys.filter((k) => k.slice(-10) >= cutoff)
  try {
    localStorage.setItem(LOCAL_READ_KEY, JSON.stringify(kept))
  } catch {
    // 시크릿 모드 등 저장이 막힌 경우 — 읽음 처리는 이번 세션에만 남는다.
  }
  return kept
}

const POLL_MS = 30_000

/**
 * 백엔드가 type 을 단계적으로 올리는 중이라 없을 수도 있고, 예전 REMINDER 행이
 * 남아 있을 수도 있다. 모르는 값은 UNKNOWN 으로 떨어뜨려 중립적으로 보여 준다.
 * ("설정한 알림" 같은 말을 붙이면 안 건 알림에 건 척을 하게 된다)
 */
function kindOf(n: NotificationResDto): NotificationKind {
  const t = (n as NotificationResDto & { type?: string }).type
  if (t === 'TASK_CREATED' || t === 'TASK_UPDATED' || t === 'TASK_COMPLETED' || t === 'OVERDUE') return t
  return 'UNKNOWN'
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

  const [localRead, setLocalRead] = useState<string[]>(loadLocalRead)

  const fromMyTasks = useMemo<AppNotification[]>(() => {
    if (!userId) return []
    const today = dayjs().format('YYYY-MM-DD')
    return itemQueries
      .flatMap((q) => q.data ?? [])
      .filter((i) => i.assigneeUserId === userId && i.status !== 'DONE' && i.dueDate)
      .flatMap<AppNotification>((i) => {
        const left = daysUntil(i.dueDate)
        if (left === null) return []
        const common = {
          projectId: i.projectId,
          actionItemId: i.id,
          taskTitle: i.title,
          at: i.dueDate ?? '',
          dueDate: i.dueDate ?? undefined,
        }
        if (left < 0) {
          // 지연은 해결될 때까지 계속 떠 있어야 해서 읽음 처리를 두지 않는다.
          return [{ ...common, key: `overdue-${i.id}`, kind: 'OVERDUE' as const, read: false }]
        }
        if (left <= DUE_SOON_NOTICE_DAYS) {
          // 키에 오늘 날짜가 들어가서, 읽고 넘겨도 내일 새 알림으로 다시 뜬다.
          const key = `duesoon-${i.id}-${today}`
          return [{ ...common, key, kind: 'DUE_SOON' as const, read: localRead.includes(key) }]
        }
        return []
      })
      .sort((a, b) => a.at.localeCompare(b.at))
  }, [itemQueries, userId, localRead])

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

  // 마감 예고·지연을 먼저, 그다음 서버 알림을 최신순으로
  const all = useMemo(
    () => [...fromMyTasks, ...fromServer.sort((a, b) => b.at.localeCompare(a.at))],
    [fromMyTasks, fromServer],
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

  const markRead = useCallback(
    (n: AppNotification) => {
      if (n.serverId) return readMutation.mutateAsync(n.serverId)
      // 지연은 상시 알림이라 읽음이 없다. 마감 예고만 오늘 하루 접어 둔다.
      if (n.kind === 'DUE_SOON') setLocalRead((prev) => (prev.includes(n.key) ? prev : saveLocalRead([...prev, n.key])))
      return Promise.resolve()
    },
    [readMutation],
  )

  const markAllRead = useCallback(async () => {
    const localKeys = all.filter((n) => n.kind === 'DUE_SOON' && !n.read).map((n) => n.key)
    if (localKeys.length) setLocalRead((prev) => saveLocalRead([...prev, ...localKeys]))
    if (all.some((n) => n.serverId && !n.read)) await readAllMutation.mutateAsync()
  }, [all, readAllMutation])

  const unreadCount = all.filter((n) => !n.read).length

  return {
    all,
    unreadCount,
    markRead,
    markAllRead,
    remove: (n: AppNotification) => (n.serverId ? deleteMutation.mutateAsync(n.serverId) : Promise.resolve()),
  }
}

export const KIND_LABEL: Record<NotificationKind, string> = {
  DUE_SOON: '마감이 다가옵니다',
  OVERDUE: '마감일이 지났습니다',
  TASK_CREATED: '새 업무가 배정되었습니다',
  TASK_UPDATED: '담당 업무가 수정되었습니다',
  TASK_COMPLETED: '담당 업무가 완료 처리되었습니다',
  UNKNOWN: '업무 알림',
}
