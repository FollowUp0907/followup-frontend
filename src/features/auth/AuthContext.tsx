import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/authApi'
import { setUnauthorizedHandler } from '@/api/client'
import { forgetPushSubscription } from '@/features/reminders/usePushNotifications'
import {
  clearSession,
  getProfile,
  getToken,
  getUserIdFromToken,
  isTokenExpired,
  readIdTokenProfile,
  saveSession,
  updateProfileName,
} from '@/lib/auth'
import type { StoredProfile } from '@/lib/auth'

interface AuthContextValue {
  user: StoredProfile | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  /** 구글 ID 토큰으로 로그인 (백엔드가 검증 후 우리 JWT 발급) */
  loginWithGoogle: (idToken: string) => Promise<void>
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
    // 이 브라우저로는 더 이상 푸시를 받지 않는다. 실패해도 로그아웃은 계속된다.
    void forgetPushSubscription()
    clearSession()
    setUser(null)
    queryClient.clear()
    // 구글 자동 로그인이 걸려 있으면 로그아웃 직후 다시 로그인되는 것을 막는다.
    window.google?.accounts.id.disableAutoSelect()
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

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const token = await authApi.googleLogin({ idToken })
    // 이름·이메일은 구글 ID 토큰에서 읽어 프로필 표시에만 사용한다.
    const profile = readIdTokenProfile(idToken)
    saveSession(token.accessToken, profile)
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
    () => ({ user, isAuthenticated: !!user, login, loginWithGoogle, signup, logout, syncName }),
    [user, login, loginWithGoogle, signup, logout, syncName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
