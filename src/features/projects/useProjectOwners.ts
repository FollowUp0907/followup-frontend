import { useQueries } from '@tanstack/react-query'
import * as projectApi from '@/api/projectApi'
import { qk } from '@/lib/queryKeys'
import type { ProjectResDto } from '@/types/api'

/**
 * 프로젝트별 소유자 이름.
 *
 * 프로젝트 목록 응답에는 만든 사람의 userId(`createdBy`)만 있고 이름이 없어서,
 * 구성원 목록에서 OWNER 를 찾는다. 같은 쿼리 키를 쓰므로 프로젝트 안으로 들어가면
 * 이미 받아 둔 것을 그대로 쓴다 — 요청이 두 번 나가지 않는다.
 */
export function useProjectOwners(projects?: ProjectResDto[]) {
  const list = projects ?? []

  const results = useQueries({
    queries: list.map((p) => ({
      queryKey: qk.members(p.id),
      queryFn: () => projectApi.listMembers(p.id),
      staleTime: 5 * 60_000,
    })),
  })

  const ownerById = new Map<number, string>()
  list.forEach((p, i) => {
    const members = results[i]?.data
    const owner = members?.find((m) => m.role === 'OWNER')
    // 구성원을 못 불러오면 이름 대신 아무것도 보여주지 않는다. 틀린 이름보다 낫다.
    if (owner?.name) ownerById.set(p.id, owner.name)
  })

  return ownerById
}
