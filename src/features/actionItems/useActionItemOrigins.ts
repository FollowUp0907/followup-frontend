import { useQueries } from '@tanstack/react-query'
import * as actionItemApi from '@/api/actionItemApi'
import { qk } from '@/lib/queryKeys'
import type { ActionItemDetailResDto } from '@/types/api'
import { useActionItems } from './queries'

/**
 * actionItemId -> originMeetingId 매핑.
 *
 * 목록 API(ActionItemListResDto)에 originMeetingId 가 없고 상세에만 있어서,
 * 목록을 받은 뒤 항목마다 상세를 조회해 클라이언트에서 조인한다. (요청 N+1)
 * 비싼 조회라서 실제로 필요한 화면에서만 enabled 로 켠다.
 *
 * → 백엔드 목록 응답에 originMeetingId 가 추가되면 이 훅은 통째로 지울 수 있다.
 *   (BACKEND_NOTES "목록 DTO에 originMeetingId" 항목)
 */
export function useActionItemOrigins(projectId: number, enabled: boolean) {
  const { data: list } = useActionItems(projectId)
  const ids = enabled ? (list?.map((i) => i.id) ?? []) : []

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.actionItem(id),
      queryFn: () => actionItemApi.getActionItem(id),
      staleTime: 60_000,
    })),
  })

  const details = results.map((r) => r.data).filter((d): d is ActionItemDetailResDto => !!d)

  const originByItemId = new Map<number, number | undefined>()
  for (const d of details) originByItemId.set(d.id, d.originMeetingId)

  return {
    originByItemId,
    isLoading: enabled && results.some((r) => r.isLoading),
    /** 아직 상세를 못 받은 항목이 있으면 필터 결과가 불완전하다 */
    isComplete: !enabled || details.length === ids.length,
  }
}
