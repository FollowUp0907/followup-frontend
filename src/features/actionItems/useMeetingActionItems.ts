import { useQueries } from '@tanstack/react-query'
import * as actionItemApi from '@/api/actionItemApi'
import { qk } from '@/lib/queryKeys'
import type { ActionItemDetailResDto } from '@/types/api'
import { useActionItems } from './queries'

/**
 * "이 회의에서 생성된 후속 업무" 를 구한다.
 *
 * 목록 API(ActionItemListResDto)에는 originMeetingId 가 없고 상세에만 있어서,
 * 목록을 받은 뒤 상세를 조회해 클라이언트에서 조인한다.
 * → 백엔드 목록 응답에 originMeetingId 가 추가되면 이 훅은 통째로 지울 수 있다.
 */
export function useMeetingActionItems(projectId: number, meetingId: number) {
  const { data: list, isLoading: listLoading } = useActionItems(projectId)
  const ids = list?.map((i) => i.id) ?? []

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.actionItem(id),
      queryFn: () => actionItemApi.getActionItem(id),
      staleTime: 60_000,
      enabled: !!meetingId,
    })),
  })

  const items = results
    .map((r) => r.data)
    .filter((d): d is ActionItemDetailResDto => !!d && d.originMeetingId === meetingId)

  return {
    items,
    isLoading: listLoading || results.some((r) => r.isLoading),
  }
}
