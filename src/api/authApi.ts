import { api } from './client'
import type {
  GoogleLoginReqDto,
  LoginReqDto,
  SignupReqDto,
  SignupResDto,
  TokenResDto,
} from '@/types/api'

export const signup = (data: SignupReqDto) => api.post<SignupResDto>('/api/auth/signup', data).then((r) => r.data)

export const login = (data: LoginReqDto) => api.post<TokenResDto>('/api/auth/login', data).then((r) => r.data)

/**
 * 구글 로그인.
 * GIS 가 발급한 ID 토큰을 백엔드가 검증하고, 우리 서비스의 accessToken 을 돌려준다.
 * 가입 이력이 없는 구글 계정이면 백엔드가 자동으로 가입 처리한다.
 */
export const googleLogin = (data: GoogleLoginReqDto) =>
  api.post<TokenResDto>('/api/auth/google', data).then((r) => r.data)

export const health = () => api.get<{ status: string }>('/api/health').then((r) => r.data)
