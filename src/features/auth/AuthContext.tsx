import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/authApi'
import { setUnauthorizedHandler } from '@/api/client'
import {
  clearSession,
  getProfile,
  getToken,
  getUserIdFromToken,
  isTokenExpired,
  saveSession,
  updateProfileName,
} from '@/lib/auth'
import type { StoredProfile } from '@/lib/auth'

interface AuthContextValue {
  user: StoredProfile | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  /** 멤버 목록에서 알아낸 실제 이름을 프로필에 반영 (백엔드에 /me 가 없어서 필요) */
  syncName: (name: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readInitialUser(): StoredProfile | null {
  const token = getToken()
  if (!token || isTokenExpired(token)) {
    clearSession()
    return null
  }
  const profile = getProfile()
  if (profile) return profile
  const userId = getUserIdFromToken(token)
  return userId ? { userId, email: '', name: '' } : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredProfile | null>(readInitialUser)
  const queryClient = useQueryClient()

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  // axios 인터셉터가 401 을 만나면 세션을 비운다.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      queryClient.clear()
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  const login = useCallback(async (email: string, password: string) => {
    const token = await authApi.login({ email, password })
    const previous = getProfile()
    saveSession(token.accessToken, {
      email,
      // 같은 계정으로 다시 로그인하면 저장돼 있던 이름을 유지한다.
      name: previous?.email === email ? previous.name : '',
    })
    setUser(getProfile())
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    await authApi.signup({ name, email, password })
    const token = await authApi.login({ email, password })
    saveSession(token.accessToken, { email, name })
    setUser(getProfile())
  }, [])

  const syncName = useCallback((name: string) => {
    updateProfileName(name)
    setUser((prev) => (prev && name && prev.name !== name ? { ...prev, name } : prev))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, login, signup, logout, syncName }),
    [user, login, signup, logout, syncName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
