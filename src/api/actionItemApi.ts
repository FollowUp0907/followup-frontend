import { api } from './client'
import type {
  ActionItemCreateReqDto,
  ActionItemDetailResDto,
  ActionItemListResDto,
  ActionItemPriority,
  ActionItemStatus,
  ActionItemUpdateReqDto,
} from '@/types/api'

export interface ActionItemFilters {
  status?: ActionItemStatus
  assigneeId?: number
  priority?: ActionItemPriority
}

export const listActionItems = (projectId: number, filters: ActionItemFilters = {}) =>
  api
    .get<ActionItemListResDto[]>(`/api/project/${projectId}/action-items`, {
      params: {
        status: filters.status,
        assigneeId: filters.assigneeId,
        priority: filters.priority,
      },
    })
    .then((r) => r.data)

export const createActionItem = (projectId: number, data: ActionItemCreateReqDto) =>
  api.post<ActionItemDetailResDto>(`/api/project/${projectId}/action-item`, data).then((r) => r.data)

export const getActionItem = (actionItemId: number) =>
  api.get<ActionItemDetailResDto>(`/api/action-item/${actionItemId}`).then((r) => r.data)

export const updateActionItem = (actionItemId: number, data: ActionItemUpdateReqDto) =>
  api.patch<ActionItemDetailResDto>(`/api/action-item/${actionItemId}`, data).then((r) => r.data)

export const deleteActionItem = (actionItemId: number) =>
  api.delete<void>(`/api/action-item/${actionItemId}`).then((r) => r.data)
