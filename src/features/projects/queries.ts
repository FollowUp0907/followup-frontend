import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as projectApi from '@/api/projectApi'
import { qk } from '@/lib/queryKeys'
import type { ProjectCreateReqDto, ProjectUpdateReqDto } from '@/types/api'

export function useProjects() {
  return useQuery({ queryKey: qk.projects, queryFn: projectApi.listProjects })
}

export function useProject(projectId: number) {
  return useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => projectApi.getProject(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectCreateReqDto) => projectApi.createProject(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects }),
  })
}

export function useUpdateProject(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectUpdateReqDto) => projectApi.updateProject(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects })
      qc.invalidateQueries({ queryKey: qk.project(projectId) })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: number) => projectApi.deleteProject(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects }),
  })
}
