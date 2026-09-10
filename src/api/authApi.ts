import { api } from './client'
import type { LoginReqDto, SignupReqDto, SignupResDto, TokenResDto } from '@/types/api'

export const signup = (data: SignupReqDto) =>
  api.post<SignupResDto>('/api/auth/signup', data).then((r) => r.data)

export const login = (data: LoginReqDto) =>
  api.post<TokenResDto>('/api/auth/login', data).then((r) => r.data)

export const health = () => api.get<{ status: string }>('/api/health').then((r) => r.data)
