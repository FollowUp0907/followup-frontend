import type { ActionItemDetailResDto, ActionItemListResDto } from '@/types/api'

/**
 * 업무의 담당자 id 목록.
 *
 * 백엔드는 아직 `assigneeUserId` 하나만 준다. 여러 명을 담으려면 서버에
 * 목록 필드가 있어야 해서(BACKEND_NOTES "담당자 여러 명" 참고), 화면은 먼저
 * 목록으로 다룰 수 있게 해 두고 필드가 생기면 그대로 이어 받는다.
 *
 * `assigneeUserIds` 가 오면 그걸 쓰고, 없으면 단수 필드를 한 명짜리 목록으로 본다.
 */
type WithAssignees = { assigneeUserIds?: number[] }

export function assigneeIdsOf(item?: (ActionItemListResDto | ActionItemDetailResDto) | null): number[] {
  if (!item) return []
  const many = (item as WithAssignees).assigneeUserIds
  if (many?.length) return [...new Set(many)]
  // 목록 DTO 는 assigneeUserId, 상세 DTO 는 assignee.userId 로 준다.
  const one =
    'assigneeUserId' in item ? item.assigneeUserId : 'assignee' in item ? item.assignee?.userId : undefined
  if (!one) return []
  // 서버가 목록을 못 받는 동안 이 브라우저에 적어 둔 나머지 담당자를 뒤에 붙인다.
  const rest = extras()[String((item as { id?: number }).id)] ?? []
  return [...new Set([one, ...rest])]
}

/** "반서현" / "반서현 외 2명" / "미지정" */
export function assigneeLabel(ids: number[], nameOf: (userId?: number) => string) {
  if (ids.length === 0) return '미지정'
  const first = nameOf(ids[0])
  return ids.length === 1 ? first : `${first} 외 ${ids.length - 1}명`
}

/**
 * 서버가 `assigneeUserIds` 를 다룰 줄 아는지.
 *
 * 응답에 한 번이라도 실려 오면 그때부터 요청에도 같이 보낸다. 지원하기 전에
 * 보내면 백엔드 설정에 따라 400 이 날 수 있어서, **받아 본 뒤에만** 보낸다.
 * (한 번 확인하면 계속 기억한다)
 */
let serverKnowsMany = false

/**
 * 서버가 담당자 목록을 받기 전까지, 두 번째 담당자부터는 **이 브라우저에** 적어 둔다.
 *
 * 백엔드에 자리가 없어서 다른 기기·다른 사람에게는 안 보인다. 그래도 화면에서는
 * 여러 명으로 다룰 수 있어야 해서 임시로 둔다. 서버가 assigneeUserIds 를 주기
 * 시작하면 이 저장소는 무시되고(위 래치), 그때 지우면 된다.
 */
const EXTRA_KEY = 'followup.actionItem.extraAssignees'

function readExtras(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(EXTRA_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, number[]>) : {}
  } catch {
    return {}
  }
}

const listeners = new Set<() => void>()
let extrasCache: Record<string, number[]> | null = null

function extras() {
  if (!extrasCache) extrasCache = readExtras()
  return extrasCache
}

/** 첫 번째 담당자는 서버가 갖고 있으니, 두 번째부터만 여기 남긴다. */
export function rememberExtraAssignees(actionItemId: number, ids: number[]) {
  const next = { ...extras() }
  const rest = ids.slice(1)
  if (rest.length) next[String(actionItemId)] = rest
  else delete next[String(actionItemId)]
  extrasCache = next
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(next))
  } catch {
    // 저장이 막혀도 이번 세션에는 반영된다.
  }
  listeners.forEach((fn) => fn())
}

export function subscribeExtraAssignees(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function extraAssigneesVersion() {
  return extras()
}

export function noteAssigneeSupport(item?: unknown) {
  if (item && Array.isArray((item as WithAssignees).assigneeUserIds)) serverKnowsMany = true
}

export function serverSupportsManyAssignees() {
  return serverKnowsMany
}

/** 담당자 목록을 서버가 받는 모양으로 바꾼다. */
export function assigneePatch(ids: number[]) {
  const first = ids[0] ?? null
  return serverKnowsMany ? { assigneeUserId: first, assigneeUserIds: ids } : { assigneeUserId: first }
}
