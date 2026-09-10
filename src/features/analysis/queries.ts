import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as aiApi from '@/api/aiApi'
import { qk } from '@/lib/queryKeys'
import type { AnalysisConfirmReqDto } from '@/types/api'

export function useRequestAnalysis() {
  return useMutation({ mutationFn: (meetingId: number) => aiApi.requestAnalysis(meetingId) })
}

/**
 * 분석 결과 조회.
 * status 가 PROCESSING 인 동안 2초 간격으로 폴링한다.
 */
export function useAnalysis(analysisId: number | null) {
  return useQuery({
    queryKey: qk.analysis(analysisId ?? 0),
    queryFn: () => aiApi.getAnalysis(analysisId as number),
    enabled: !!analysisId && analysisId > 0,
    refetchInterval: (query) => (query.state.data?.status === 'PROCESSING' ? 2000 : false),
    refetchIntervalInBackground: true,
  })
}

export function useConfirmAnalysis(projectId: number, meetingId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ analysisId, data }: { analysisId: number; data: AnalysisConfirmReqDto }) =>
      aiApi.confirmAnalysis(analysisId, data),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: qk.analysis(variables.analysisId) })
      qc.invalidateQueries({ queryKey: qk.meeting(meetingId) })
      qc.invalidateQueries({ queryKey: qk.meetings(projectId) })
      qc.invalidateQueries({ queryKey: ['project', projectId, 'action-items'] })
      qc.invalidateQueries({ queryKey: qk.dashboard(projectId) })
    },
  })
}
