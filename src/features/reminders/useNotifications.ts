import { useCallback, useEffect, useMemo, useState } from 'react'
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
 * 프론트가 계산한 알림(마감 예고·지연)의 읽음/지움 상태.
 *
 * 마감 예고 키에는 날짜가 들어 있어서 자정이 지나면 **저절로 새 키**가 된다.
 * 그래서 오늘 읽고 넘겨도 내일 다시 뜬다. 따로 만료 처리를 하지 않아도 된다.
 *
 * 지연 알림은 상시라 읽음이 없지만, 손으로 지울 수는 있어야 해서 지움 목록을
 * 따로 둔다. 지워도 마감일이 바뀌면(= 키가 바뀌면) 다시 뜬다.
 *
 * 둘 다 이 브라우저에만 저장한다 — 서버가 만든 알림이 아니라 화면이 계산한 것이라
 * 기기마다 따로 읽어도 문제가 없다.
 */
const LOCAL_READ_KEY = 'followup.notifications.read'
const LOCAL_HIDDEN_KEY = 'followup.notifications.hidden'

function loadKeys(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function saveKeys(storageKey: string, keys: string[]) {
  // 마감 예고 키는 끝이 날짜라 지난 것을 떨군다. 안 그러면 계속 쌓인다.
  const cutoff = dayjs().subtract(2, 'day').format('YYYY-MM-DD')
  const kept = keys.filter((k) => !/\d{4}-\d{2}-\d{2}$/.test(k) || k.slice(-10) >= cutoff)
  try {
    localStorage.setItem(storageKey, JSON.stringify(kept))
  } catch {
    // 시크릿 모드 등 저장이 막힌 경우 — 이번 세션에만 남는다.
  }
  return kept
}

/**
 * 서버가 밀어 주지 않아서 주기적으로 물어본다.
 * 여기에 더해 (1) 창으로 돌아올 때 (2) 탭이 다시 보일 때 (3) 종을 열 때
 * 즉시 한 번 더 받아 온다. 그래서 새로고침 없이도 바로 반영된다.
 * 진짜 즉시 전달은 SSE 가 필요하다 — NOTIFICATIONS.md 3부 ② 참고.
 */
const POLL_MS = 15_000

/**
 * 백엔드가 type 을 단계적으로 올리는 중이라 없을 수도 있고, 예전 REMINDER 행이
 * 남아 있을 수도 있다. 모르는 값은 UNKNOWN 으로 떨어뜨려 중립적으로 보여 준다.
 * ("설정한 알림" 같은 말을 붙이면 안 건 알림에 건 척을 하게 된다)
 */
const SERVER_KINDS = ['DUE_SOON', 'OVERDUE', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED'] as const

function kindOf(n: NotificationResDto): NotificationKind {
  const t = (n as NotificationResDto & { type?: string }).type
  return (SERVER_KINDS as readonly string[]).includes(t ?? '') ? (t as NotificationKind) : 'UNKNOWN'
}

export function useNotifications(userId?: number, { active = true }: { active?: boolean } = {}) {
  const qc = useQueryClient()
  const enabled = !!userId

  /** 알림에 영향을 주는 질의를 전부 다시 받아 온다. */
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.notifications })
    void qc.invalidateQueries({ queryKey: ['project'], predicate: (q) => q.queryKey[2] === 'action-items' })
  }, [qc])

  // 탭이 다시 보이거나 네트워크가 돌아오면 기다리지 않고 바로 확인한다.
  useEffect(() => {
    if (!enabled) return
    const onWake = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [enabled, refresh])

  // 종을 열면 그 순간 최신으로 맞춘다.
  useEffect(() => {
    if (enabled && active) refresh()
  }, [enabled, active, refresh])

  // 1) 서버가 만들어 준 알림
  const { data: server } = useQuery({
    queryKey: qk.notifications,
    queryFn: () => notificationApi.listNotifications(),
    enabled,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
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
      // 창으로 돌아왔을 때 기다리지 않고 바로 맞춘다.
      refetchOnWindowFocus: true,
      staleTime: 0,
    })),
  })

  const [localRead, setLocalRead] = useState<string[]>(() => loadKeys(LOCAL_READ_KEY))
  const [hidden, setHidden] = useState<string[]>(() => loadKeys(LOCAL_HIDDEN_KEY))

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
          // 키에 마감일을 넣는다. 마감을 옮기면 지웠던 알림도 새 알림으로 다시 뜬다.
          return [{ ...common, key: `overdue-${i.id}-${i.dueDate}`, kind: 'OVERDUE' as const, read: false }]
        }
        if (left <= DUE_SOON_NOTICE_DAYS) {
          // 키에 오늘 날짜가 들어가서, 읽고 넘겨도 내일 새 알림으로 다시 뜬다.
          const key = `duesoon-${i.id}-${today}`
          return [{ ...common, key, kind: 'DUE_SOON' as const, read: localRead.includes(key) }]
        }
        return []
      })
      .filter((n) => !hidden.includes(n.key))
      .sort((a, b) => a.at.localeCompare(b.at))
  }, [itemQueries, userId, localRead, hidden])

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
      if (n.kind === 'DUE_SOON')
        setLocalRead((prev) => (prev.includes(n.key) ? prev : saveKeys(LOCAL_READ_KEY, [...prev, n.key])))
      return Promise.resolve()
    },
    [readMutation],
  )

  const markAllRead = useCallback(async () => {
    const localKeys = all.filter((n) => n.kind === 'DUE_SOON' && !n.read).map((n) => n.key)
    if (localKeys.length) setLocalRead((prev) => saveKeys(LOCAL_READ_KEY, [...prev, ...localKeys]))
    if (all.some((n) => n.serverId && !n.read)) await readAllMutation.mutateAsync()
  }, [all, readAllMutation])

  /** 서버 알림은 서버에서 지우고, 프론트가 만든 것은 이 브라우저에서 숨긴다. */
  const remove = useCallback(
    (n: AppNotification) => {
      if (n.serverId) return deleteMutation.mutateAsync(n.serverId)
      setHidden((prev) => (prev.includes(n.key) ? prev : saveKeys(LOCAL_HIDDEN_KEY, [...prev, n.key])))
      return Promise.resolve()
    },
    [deleteMutation],
  )

  const unreadCount = all.filter((n) => !n.read).length

  return {
    all,
    unreadCount,
    markRead,
    markAllRead,
    remove,
    refresh,
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
