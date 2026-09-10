import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

/** 로그인해야 볼 수 있는 화면 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** 이미 로그인했으면 로그인/회원가입 화면 대신 프로젝트 목록으로 */
export function RedirectIfAuthenticated() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/projects" replace />
  return <Outlet />
}
