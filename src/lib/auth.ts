/** 토큰 보관 + JWT 파싱. 백엔드에 /me 엔드포인트가 없어 sub(userId)를 토큰에서 읽는다. */

const TOKEN_KEY = 'followup.accessToken'
const PROFILE_KEY = 'followup.profile'

export interface StoredProfile {
  userId: number
  email: string
  name: string
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * 구글 ID 토큰에서 이름·이메일을 읽는다.
 * 백엔드에 /me 가 없어서 프로필 표시용으로만 쓰고, 인증 판단에는 쓰지 않는다.
 * (검증은 백엔드가 한다 — 여기서 읽은 값은 신뢰 대상이 아니라 표시용)
 */
export function readIdTokenProfile(idToken: string): { email: string; name: string } {
  const payload = decodeJwtPayload(idToken)
  const email = typeof payload?.email === 'string' ? payload.email : ''
  const name = typeof payload?.name === 'string' ? payload.name : ''
  return { email, name }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp !== 'number') return false
  return Date.now() >= exp * 1000
}

export function getUserIdFromToken(token: string): number | null {
  const payload = decodeJwtPayload(token)
  const sub = payload?.sub
  const n = Number(sub)
  return Number.isFinite(n) ? n : null
}

export function saveSession(token: string, profile: Omit<StoredProfile, 'userId'> & { userId?: number }) {
  localStorage.setItem(TOKEN_KEY, token)
  const userId = profile.userId ?? getUserIdFromToken(token) ?? 0
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, userId }))
}

export function getProfile(): StoredProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredProfile
  } catch {
    return null
  }
}

export function updateProfileName(name: string) {
  const p = getProfile()
  if (!p || !name || p.name === name) return
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...p, name }))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PROFILE_KEY)
}
