import { useQueries } from '@tanstack/react-query'
import * as meetingApi from '@/api/meetingApi'
import { qk } from '@/lib/queryKeys'
import type { MeetingDetailResDto, MeetingStatus } from '@/types/api'
import { useMeetings } from './queries'

/**
 * 회의의 "실제" 상태를 구한다.
 *
 * 백엔드는 AI 분석을 확정해도 meeting.status 를 DRAFT 로 남긴다.
 * (BACKEND_NOTES "분석 확정 후에도 회의 status 가 DRAFT" 항목)
 * 그래서 화면에서는 확정의 부산물인 decisions 로 판정한다.
 * 결정 사항은 분석 확정 시점에만 생성되므로, 하나라도 있으면 분석이 끝난 회의다.
 *
 * 백엔드가 status 를 갱신하기 시작하면 status 만 보면 되고 이 파일은 지울 수 있다.
 */
export function deriveMeetingStatus(detail?: MeetingDetailResDto): MeetingStatus {
  if (!detail) return 'DRAFT'
  if (detail.status === 'CONFIRMED') return 'CONFIRMED'
  return (detail.decisions?.length ?? 0) > 0 ? 'CONFIRMED' : 'DRAFT'
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

  const statusById = new Map<number, MeetingStatus>()
  for (const r of results) {
    if (r.data) statusById.set(r.data.id, deriveMeetingStatus(r.data))
  }

  return { statusById, isLoading: results.some((r) => r.isLoading) }
}
