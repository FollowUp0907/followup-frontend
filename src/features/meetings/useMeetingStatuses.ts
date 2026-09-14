import { useQueries } from '@tanstack/react-query'
import * as meetingApi from '@/api/meetingApi'
import { useActionItemOrigins } from '@/features/actionItems/useActionItemOrigins'
import { qk } from '@/lib/queryKeys'
import type { MeetingDetailResDto, MeetingStatus } from '@/types/api'
import { useMeetings } from './queries'

/**
 * 회의의 "실제" 상태를 구한다.
 *
 * 백엔드는 AI 분석을 확정해도 meeting.status 를 DRAFT 로 남긴다.
 * (BACKEND_NOTES "분석 확정 후에도 회의 status 가 DRAFT" 항목)
 * 그래서 확정의 부산물로 판정한다. 확정하면 결정 사항과 후속 업무가 생기는데,
 * 둘 중 하나만 만들고 확정하는 경우가 있어서 (실제로 결정 사항 0건 + 업무 1건인
 * 회의가 있었다) 둘 다 봐야 한다.
 *
 * 백엔드가 status 를 갱신하기 시작하면 status 만 보면 되고 이 파일은 지울 수 있다.
 */
export function deriveMeetingStatus(
  detail: MeetingDetailResDto | undefined,
  hasGeneratedItems: boolean,
): MeetingStatus {
  if (!detail) return 'DRAFT'
  if (detail.status === 'CONFIRMED') return 'CONFIRMED'
  if ((detail.decisions?.length ?? 0) > 0) return 'CONFIRMED'
  return hasGeneratedItems ? 'CONFIRMED' : 'DRAFT'
}

/** 회의 목록용 — id -> 실제 상태. 목록 DTO 에는 판정 근거가 없어 상세를 함께 받는다. */
export function useMeetingStatuses(projectId: number) {
  const { data: meetings } = useMeetings(projectId)
  const ids = meetings?.map((m) => m.id) ?? []

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.meeting(id),
      queryFn: () => meetingApi.getMeeting(id),
      staleTime: 60_000,
    })),
  })

  // 어떤 회의가 후속 업무를 만들어 냈는지 — 확정의 또 다른 증거
  const { originByItemId } = useActionItemOrigins(projectId, ids.length > 0)
  const meetingsWithItems = new Set([...originByItemId.values()].filter((v): v is number => v !== undefined))

  const statusById = new Map<number, MeetingStatus>()
  for (const r of results) {
    if (r.data) statusById.set(r.data.id, deriveMeetingStatus(r.data, meetingsWithItems.has(r.data.id)))
  }

  return { statusById, isLoading: results.some((r) => r.isLoading) }
}
