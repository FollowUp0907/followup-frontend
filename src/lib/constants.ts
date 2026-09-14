import type { ActionItemPriority, ActionItemStatus, MeetingStatus, ProjectRole } from '@/types/api'

export const STATUS_LABEL: Record<ActionItemStatus, string> = {
  TODO: '예정',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
}

export const STATUS_ORDER: ActionItemStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

export const PRIORITY_LABEL: Record<ActionItemPriority, string> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

export const PRIORITY_ORDER: ActionItemPriority[] = ['HIGH', 'MEDIUM', 'LOW']

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  DRAFT: '작성 중',
  CONFIRMED: '분석 완료',
}

export const ROLE_LABEL: Record<ProjectRole, string> = {
  OWNER: '소유자',
  MEMBER: '멤버',
}

/** 아바타 파스텔 채움 — 디자인 시스템에서 파스텔이 허용되는 유일한 자리 */
export const AVATAR_COLORS = ['#fb923c', '#ec4899', '#8b5cf6', '#34d399', '#3b82f6'] as const

export function avatarColor(seed: string | number) {
  const s = String(seed)
  let hash = 0
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/** 보드 컬럼 헤더의 상태 점 (시안 STATUS_META) */
export const STATUS_DOT_COLOR: Record<ActionItemStatus, string> = {
  TODO: '#898989',
  IN_PROGRESS: '#3b82f6',
  DONE: '#10b981',
}

/** 보드 카드의 우선순위 아이콘 색 (시안 PRIORITY_ICON) */
export const PRIORITY_ICON_COLOR: Record<ActionItemPriority, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#3b82f6',
}

/** 업무 키 표기 (시안의 FU-101 형태) */
export function taskKey(id: number) {
  return `FU-${100 + id}`
}
