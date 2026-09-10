import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as projectApi from '@/api/projectApi'
import { qk } from '@/lib/queryKeys'

export function useMembers(projectId: number) {
  return useQuery({
    queryKey: qk.members(projectId),
    queryFn: () => projectApi.listMembers(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  })
}

export function useAddMember(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => projectApi.addMember(projectId, { email }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectId) })
      qc.invalidateQueries({ queryKey: qk.dashboard(projectId) })
    },
  })
}

export function useRemoveMember(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => projectApi.removeMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectId) })
      qc.invalidateQueries({ queryKey: qk.dashboard(projectId) })
    },
  })
}
