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

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * 401 이 와도 로그아웃시키지 않는다.
     *
     * 아직 백엔드에 없을 수 있는 기능을 부를 때 쓴다. 우리 백엔드(Spring Security)는
     * 매핑되지 않은 경로에도 401 을 주기 때문에, 그걸 "세션 만료" 로 받으면
     * 멀쩡히 쓰던 사람이 튕겨 나간다.
     */
    skipAuthLogout?: boolean
  }
}

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
      return Promise.reject(new ApiError('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해 주세요.', 0))
    }

    const { status, data } = error.response
    /*
     * 401 은 보통 "세션이 끝났다" 는 뜻이라 로그아웃시킨다.
     * 다만 로그인 전에 부르는 /api/auth/* 는 예외다 — 비밀번호가 틀렸거나
     * 아직 없는 엔드포인트라는 뜻이지, 세션과는 상관이 없다.
     */
    const preAuth = (error.config?.url ?? '').startsWith('/api/auth/')
    if (status === 401 && !preAuth && !error.config?.skipAuthLogout) {
      clearSession()
      onUnauthorized?.()
    }
    const message = data?.message || DEFAULT_MESSAGE[status] || '알 수 없는 오류가 발생했습니다.'
    return Promise.reject(new ApiError(message, status, data?.code))
  },
)

/** 스프링 시큐리티가 "경로 자체를 모를 때" 돌려주는 일반 코드들 */
const GENERIC_AUTH_CODES = ['UNAUTHORIZED', 'FORBIDDEN', 'ACCESS_DENIED']

/**
 * 백엔드에 아직 이 엔드포인트가 없는가?
 *
 * 우리 백엔드는 매핑되지 않은 경로에 404 가 아니라 **401 UNAUTHORIZED** 를 준다.
 * 그래서 401/403 중 "일반적인 권한 코드" 인 것도 없는 API 로 본다.
 * INVALID_GOOGLE_TOKEN 처럼 기능별 코드가 붙어 있으면 진짜 실패로 취급한다.
 */
export function isEndpointMissing(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false
  if (e.status === 404 || e.status === 405 || e.status === 501) return true
  if (e.status !== 401 && e.status !== 403) return false
  return !e.code || GENERIC_AUTH_CODES.includes(e.code)
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return '알 수 없는 오류가 발생했습니다.'
}
