import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as actionItemApi from '@/api/actionItemApi'
import type { ActionItemFilters } from '@/api/actionItemApi'
import { qk } from '@/lib/queryKeys'
import type { ActionItemCreateReqDto, ActionItemListResDto, ActionItemUpdateReqDto } from '@/types/api'

export function useActionItems(projectId: number, filters: ActionItemFilters = {}) {
  return useQuery({
    queryKey: qk.actionItems(projectId, filters),
    queryFn: () => actionItemApi.listActionItems(projectId, filters),
    enabled: Number.isFinite(projectId) && projectId > 0,
  })
}

export function useActionItem(actionItemId: number) {
  return useQuery({
    queryKey: qk.actionItem(actionItemId),
    queryFn: () => actionItemApi.getActionItem(actionItemId),
    enabled: Number.isFinite(actionItemId) && actionItemId > 0,
  })
}

/** 프로젝트 하위의 후속 업무 관련 캐시를 한 번에 무효화 */
function invalidateProjectScope(qc: ReturnType<typeof useQueryClient>, projectId: number) {
  qc.invalidateQueries({ queryKey: ['project', projectId, 'action-items'] })
  qc.invalidateQueries({ queryKey: qk.dashboard(projectId) })
  // 마감·지연 알림은 업무에서 계산하므로 같이 다시 받아야 종이 바로 바뀐다.
  qc.invalidateQueries({ queryKey: qk.notifications })
}

export function useCreateActionItem(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ActionItemCreateReqDto) => actionItemApi.createActionItem(projectId, data),
    onSuccess: () => invalidateProjectScope(qc, projectId),
  })
}

export function useUpdateActionItem(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ActionItemUpdateReqDto }) =>
      actionItemApi.updateActionItem(id, data),
    // 칸반에서 상태를 바꿀 때 즉시 반응하도록 낙관적 업데이트를 건다.
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['project', projectId, 'action-items'] })
      const snapshots = qc.getQueriesData<ActionItemListResDto[]>({
        queryKey: ['project', projectId, 'action-items'],
      })
      snapshots.forEach(([key, list]) => {
        if (!list) return
        qc.setQueryData<ActionItemListResDto[]>(
          key,
          list.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(data.status ? { status: data.status } : {}),
                  ...(data.priority ? { priority: data.priority } : {}),
                  ...(data.title ? { title: data.title } : {}),
                  ...(data.dueDate !== undefined ? { dueDate: data.dueDate ?? undefined } : {}),
                  // 담당자는 새 필드(배열)와 구 필드를 같이 맞춰 둔다. 서버 응답이
                  // 어느 모양으로 오든 화면이 바로 바뀌게.
                  ...(data.assigneeUserIds !== undefined ? { assigneeUserIds: data.assigneeUserIds } : {}),
                  ...(data.assigneeUserId !== undefined
                    ? { assigneeUserId: data.assigneeUserId ?? undefined }
                    : {}),
                }
              : item,
          ),
        )
      })
      return { snapshots }
    },
    onError: (_e, _v, context) => {
      context?.snapshots.forEach(([key, list]) => qc.setQueryData(key, list))
    },
    onSettled: (_d, _e, variables) => {
      invalidateProjectScope(qc, projectId)
      qc.invalidateQueries({ queryKey: qk.actionItem(variables.id) })
    },
  })
}

export function useDeleteActionItem(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (actionItemId: number) => actionItemApi.deleteActionItem(actionItemId),
    onSuccess: () => invalidateProjectScope(qc, projectId),
  })
}
