import { useCallback, useEffect, useState } from 'react'

/**
 * 후속 업무 알림 — 브라우저 저장소 기반.
 *
 * 백엔드에 알림 API 가 없어서 localStorage 에 담는다. 그래서 한계가 분명하다.
 *  - 이 브라우저에서만 보인다 (다른 기기·다른 브라우저에는 없음)
 *  - 앱이 열려 있을 때만 알림이 뜬다 (서버가 깨워 주지 못함)
 *  - 저장소를 비우면 사라진다
 *
 * 백엔드에 알림 API 가 생기면 이 파일의 read/write 만 API 호출로 바꾸면 되고,
 * 화면 쪽(useReminders 를 쓰는 곳)은 손대지 않아도 된다.
 */

export interface Reminder {
  id: string
  userId: number
  projectId: number
  actionItemId: number
  /** 알림 목록에서 보여줄 업무 제목 스냅샷 */
  taskTitle: string
  /** 알릴 시각 (ISO) */
  remindAt: string
  createdAt: string
  /** 사용자가 확인한 시각 */
  readAt?: string
}

const KEY = 'followup.reminders'
const EVENT = 'followup:reminders-changed'

function readAll(): Reminder[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Reminder[]) : []
  } catch {
    return []
  }
}

function writeAll(list: Reminder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // 저장소가 막혀 있어도 화면은 계속 동작해야 한다.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function isDue(r: Reminder, now = Date.now()) {
  return new Date(r.remindAt).getTime() <= now
}

/**
 * 알림 목록을 구독한다.
 * 다른 탭/다른 컴포넌트에서 바뀌어도 같은 값을 보도록 이벤트로 동기화한다.
 */
export function useReminders(userId?: number) {
  const [all, setAll] = useState<Reminder[]>(readAll)
  // 시각이 지났는지 주기적으로 다시 판단하기 위한 tick
  const [, setTick] = useState(0)

  useEffect(() => {
    const sync = () => setAll(readAll())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    const timer = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
      window.clearInterval(timer)
    }
  }, [])

  const mine = userId ? all.filter((r) => r.userId === userId) : all
  const due = mine.filter((r) => isDue(r)).sort((a, b) => b.remindAt.localeCompare(a.remindAt))
  const scheduled = mine.filter((r) => !isDue(r)).sort((a, b) => a.remindAt.localeCompare(b.remindAt))
  const unreadCount = due.filter((r) => !r.readAt).length

  const upsert = useCallback((reminder: Omit<Reminder, 'id' | 'createdAt'> & { id?: string }) => {
    const list = readAll()
    // 업무당 하나만 유지한다. 같은 업무에 다시 걸면 덮어쓴다.
    const rest = list.filter((r) => !(r.userId === reminder.userId && r.actionItemId === reminder.actionItemId))
    writeAll([
      ...rest,
      {
        ...reminder,
        id: reminder.id ?? `${reminder.actionItemId}-${Date.now()}`,
        createdAt: new Date().toISOString(),
        readAt: undefined,
      },
    ])
  }, [])

  const remove = useCallback((id: string) => {
    writeAll(readAll().filter((r) => r.id !== id))
  }, [])

  const removeForTask = useCallback((userId2: number, actionItemId: number) => {
    writeAll(readAll().filter((r) => !(r.userId === userId2 && r.actionItemId === actionItemId)))
  }, [])

  const markRead = useCallback((id: string) => {
    writeAll(readAll().map((r) => (r.id === id ? { ...r, readAt: new Date().toISOString() } : r)))
  }, [])

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString()
    writeAll(readAll().map((r) => (isDue(r) && !r.readAt ? { ...r, readAt: now } : r)))
  }, [])

  const forTask = useCallback((actionItemId: number) => mine.find((r) => r.actionItemId === actionItemId), [mine])

  return { due, scheduled, unreadCount, upsert, remove, removeForTask, markRead, markAllRead, forTask }
}
