import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as projectApi from '@/api/projectApi'
import { useAuth } from '@/features/auth/AuthContext'
import { qk } from '@/lib/queryKeys'
import type { ProjectResDto } from '@/types/api'

/**
 * 프로젝트 목록 화면에서 내 이름을 알아낸다.
 *
 * 백엔드에 /me 가 없어서, 로그인만으로는 이름을 알 수 없다. 프로젝트 안으로 들어가면
 * 구성원 목록에서 알아내지만(ProjectContext), 목록 화면에는 그럴 기회가 없어서
 * 우측 상단에 "이름 미확인" 이 떴다.
 *
 * 그래서 이름을 모를 때만, 첫 프로젝트의 구성원 목록을 한 번 불러 내 이름을 찾는다.
 * 한 번 알아내면 localStorage 에 남으므로 다음부터는 요청하지 않는다.
 */
export function useProfileName(projects?: ProjectResDto[]) {
  const { user, syncName } = useAuth()
  const unknown = !!user && !user.name
  const firstProjectId = projects?.[0]?.id

  const { data } = useQuery({
    queryKey: qk.members(firstProjectId ?? 0),
    queryFn: () => projectApi.listMembers(firstProjectId as number),
    enabled: unknown && !!firstProjectId,
    staleTime: 60_000,
  })

  useEffect(() => {
    const me = data?.find((m) => m.userId === user?.userId)
    if (me?.name) syncName(me.name)
  }, [data, user?.userId, syncName])
}
