import { useQuery } from '@tanstack/react-query'
import * as dashboardApi from '@/api/dashboardApi'
import { qk } from '@/lib/queryKeys'

export function useDashboard(projectId: number) {
  return useQuery({
    queryKey: qk.dashboard(projectId),
    queryFn: () => dashboardApi.getDashboard(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  })
}
