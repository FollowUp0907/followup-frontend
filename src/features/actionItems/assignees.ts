import type { ActionItemDetailResDto, ActionItemListResDto } from '@/types/api'

/**
 * 담당자는 여러 명이다.
 *
 * 백엔드가 2026-09-18 에 필드를 갈아 끼운다.
 *   응답  assignee / assigneeUserId  ->  assignees[] / assigneeUserIds[]
 *   요청  assigneeUserId             ->  assigneeUserIds[]
 *
 * 배포 순서를 맞출 필요가 없도록 **양쪽 모양을 다 읽고, 요청에는 둘 다 실어 보낸다.**
 * 새 서버는 모르는 필드를 무시하고, 구 서버도 모르는 필드를 무시한다.
 * 백엔드 배포가 끝나면 @deprecated 표시된 것들을 지우면 된다.
 */

/** 응답에 들어올 수 있는 모든 담당자 모양 */
type AnyAssigneeShape = {
  id?: number
  assignees?: Array<{ userId: number }>
  assigneeUserIds?: number[]
  assigneeUserId?: number | null
  assignee?: { userId: number } | null
}

export function assigneeIdsOf(
  item?: (ActionItemListResDto | ActionItemDetailResDto | AnyAssigneeShape) | null,
): number[] {
  if (!item) return []
  const v = item as AnyAssigneeShape

  // 새 스펙 — 이게 오면 그대로 쓴다.
  if (v.assignees?.length) return [...new Set(v.assignees.map((a) => a.userId))]
  if (v.assigneeUserIds?.length) return [...new Set(v.assigneeUserIds)]
  // 새 스펙이지만 비어 있는 경우(담당자 없음)와 구 스펙을 구분한다.
  if (Array.isArray(v.assignees) || Array.isArray(v.assigneeUserIds)) return []

  // 구 스펙 — 한 명뿐이다. 그동안 브라우저에 적어 둔 나머지를 뒤에 붙인다.
  const one = v.assigneeUserId ?? v.assignee?.userId
  if (!one) return []
  const rest = v.id ? (readExtras()[String(v.id)] ?? []) : []
  return [...new Set([one, ...rest])]
}

/** 이름만 오는 응답(대시보드 마감 임박)용 */
export function assigneeNamesOf(item?: { assigneeNames?: string[]; assigneeName?: string } | null): string[] {
  if (!item) return []
  if (item.assigneeNames?.length) return item.assigneeNames
  if (Array.isArray(item.assigneeNames)) return []
  return item.assigneeName ? [item.assigneeName] : []
}

/** "반서현" / "반서현 외 2명" / "미지정" */
export function assigneeLabel(ids: number[], nameOf: (userId?: number) => string) {
  if (ids.length === 0) return '미지정'
  const first = nameOf(ids[0])
  return ids.length === 1 ? first : `${first} 외 ${ids.length - 1}명`
}

/** 이름 배열로 같은 문구를 만든다. */
export function assigneeLabelFromNames(names: string[]) {
  if (names.length === 0) return '담당자 미지정'
  return names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}명`
}

/**
 * 담당자 목록을 요청 모양으로.
 * 새 필드와 구 필드를 같이 보내서 어느 서버에 붙어도 동작하게 한다.
 */
export function assigneePatch(ids: number[]) {
  return { assigneeUserIds: ids, assigneeUserId: ids[0] ?? null }
}

/* ------------------------------------------------------------------ *
 * 아래는 백엔드가 여러 명을 못 받던 동안 쓰던 임시 저장소다.
 * 새 스펙이 배포되면 응답에 배열이 실려 오므로 위에서 더 이상 읽지 않는다.
 * 배포 확인 후 이 블록과 호출부를 지우면 된다.
 * ------------------------------------------------------------------ */

const EXTRA_KEY = 'followup.actionItem.extraAssignees'
let extrasCache: Record<string, number[]> | null = null

function readExtras(): Record<string, number[]> {
  if (extrasCache) return extrasCache
  try {
    const raw = localStorage.getItem(EXTRA_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    extrasCache =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, number[]>) : {}
  } catch {
    extrasCache = {}
  }
  return extrasCache
}

/** @deprecated 백엔드가 assigneeUserIds 를 받기 시작하면 필요 없다. */
export function rememberExtraAssignees(actionItemId: number, ids: number[]) {
  const next = { ...readExtras() }
  const rest = ids.slice(1)
  if (rest.length) next[String(actionItemId)] = rest
  else delete next[String(actionItemId)]
  extrasCache = next
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(next))
  } catch {
    // 저장이 막혀도 이번 세션에는 반영된다.
  }
}
