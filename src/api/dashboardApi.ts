import { api } from './client'
import type { DashboardResDto } from '@/types/api'

export const getDashboard = (projectId: number) =>
  api.get<DashboardResDto>(`/api/project/${projectId}/dashboard`).then((r) => r.data)
