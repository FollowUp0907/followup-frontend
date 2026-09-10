import { api } from './client'
import type { AnalysisConfirmReqDto, AnalysisResDto } from '@/types/api'

/**
 * AI 분석 요청.
 * 200 = 재사용 가능한 기존 분석 반환 / 201 = 새 분석 생성.
 * 응답 status 가 PROCESSING 이면 getAnalysis 로 폴링해야 한다.
 */
export const requestAnalysis = (meetingId: number) =>
  api.post<AnalysisResDto>(`/api/meeting/${meetingId}/analysis`).then((r) => r.data)

export const getAnalysis = (analysisId: number) =>
  api.get<AnalysisResDto>(`/api/analysis/${analysisId}`).then((r) => r.data)

/** 초안을 사용자가 검토·수정한 최종 값으로 확정 → 실제 후속 업무가 생성된다. */
export const confirmAnalysis = (analysisId: number, data: AnalysisConfirmReqDto) =>
  api.post<AnalysisResDto>(`/api/analysis/${analysisId}/confirm`, data).then((r) => r.data)
