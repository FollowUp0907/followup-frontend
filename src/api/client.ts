import axios, { AxiosError } from 'axios'
import { clearSession, getToken, isTokenExpired } from '@/lib/auth'
import type { ErrorResponse } from '@/types/api'

/**
 * baseURL 이 비어 있으면 같은 오리진으로 요청한다.
 *  - 로컬:   vite dev server 프록시 (vite.config.ts)
 *  - Vercel: vercel.json rewrites
 * 백엔드가 http 이고 Vercel 은 https 이기 때문에, 브라우저에서 직접 호출하면
 * mixed content + CORS 로 둘 다 막힌다. 그래서 항상 프록시를 경유한다.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

/** 401 을 만났을 때 앱 전체가 반응할 수 있도록 하는 훅 */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !isTokenExpired(token)) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const DEFAULT_MESSAGE: Record<number, string> = {
  400: '요청 형식이 올바르지 않습니다.',
  401: '로그인이 필요합니다.',
  403: '이 작업을 수행할 권한이 없습니다.',
  404: '요청한 데이터를 찾을 수 없습니다.',
  409: '이미 존재하는 데이터입니다.',
  500: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ErrorResponse>) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('요청 시간이 초과되었습니다.', 0))
    }
    if (!error.response) {
      return Promise.reject(
        new ApiError('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해 주세요.', 0),
      )
    }

    const { status, data } = error.response
    if (status === 401) {
      clearSession()
      onUnauthorized?.()
    }
    const message = data?.message || DEFAULT_MESSAGE[status] || '알 수 없는 오류가 발생했습니다.'
    return Promise.reject(new ApiError(message, status, data?.code))
  },
)

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return '알 수 없는 오류가 발생했습니다.'
}
