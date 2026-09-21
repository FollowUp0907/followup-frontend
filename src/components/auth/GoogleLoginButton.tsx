import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, errorMessage, isEndpointMissing } from '@/api/client'
import { Spinner } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { GOOGLE_CLIENT_ID, isGoogleLoginEnabled, loadGoogleIdentity } from '@/lib/googleAuth'
import type { GoogleCredentialResponse } from '@/lib/googleAuth'

/**
 * 백엔드가 내려주는 실패 코드를 사람 말로 바꾼다.
 *
 * 401 은 기본 문구가 "로그인이 필요합니다." 라서, 로그인을 시도하다 실패한 자리에
 * 그대로 띄우면 무슨 말인지 알 수 없다. 그래서 코드별로 따로 적는다.
 */
function loginErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return errorMessage(e)

  switch (e.code) {
    case 'INVALID_GOOGLE_TOKEN':
      return '구글 인증 정보를 확인하지 못했습니다. 다시 시도해 주세요.'
    case 'GOOGLE_EMAIL_NOT_VERIFIED':
      return '구글 계정의 이메일이 인증되지 않았습니다. 구글에서 이메일 인증을 마친 뒤 다시 시도해 주세요.'
  }

  // 서버에 경로 자체가 없을 때. (우리 백엔드는 매핑 안 된 경로에 401 을 주기도 한다)
  if (isEndpointMissing(e)) {
    return '구글 로그인을 지금 사용할 수 없습니다. 이메일 로그인을 사용해 주세요.'
  }
  return errorMessage(e)
}

/**
 * 구글 로그인 버튼.
 *
 * 구글이 렌더링하는 공식 버튼을 쓴다. (브랜드 가이드라인 준수 + 동작 신뢰성)
 * 래퍼에 rounded-md + overflow-hidden 을 걸어 디자인 시스템의 8px 반경에 맞춘다.
 *
 * VITE_GOOGLE_CLIENT_ID 가 없으면 아무것도 렌더링하지 않는다.
 */
export function GoogleLoginButton({ redirectTo = '/projects' }: { redirectTo?: string }) {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 콜백이 최신 상태를 보도록 ref 로 들고 있는다. (GIS 는 initialize 시점의 콜백을 고정한다)
  const handlerRef = useRef<(res: GoogleCredentialResponse) => void>(() => {})
  handlerRef.current = async (res: GoogleCredentialResponse) => {
    if (!res.credential) {
      setError('구글에서 인증 정보를 받지 못했습니다.')
      return
    }
    setError(null)
    setPending(true)
    try {
      await loginWithGoogle(res.credential)
      navigate(redirectTo, { replace: true })
    } catch (e) {
      setError(loginErrorMessage(e))
      setPending(false)
    }
  }

  useEffect(() => {
    if (!isGoogleLoginEnabled()) return
    let cancelled = false

    loadGoogleIdentity()
      .then((id) => {
        if (cancelled || !containerRef.current) return
        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => handlerRef.current(res),
          // One Tap 자동 로그인은 끄고, 사용자가 버튼을 누를 때만 동작하게 한다.
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          locale: 'ko',
          width: containerRef.current.offsetWidth || 400,
        })
        setReady(true)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!isGoogleLoginEnabled()) return null

  return (
    <div>
      <div className="my-lg flex items-center gap-sm">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-caption font-normal text-muted-soft">또는</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="relative">
        {/* 구글 버튼 자리 — 로드 전에는 같은 높이의 플레이스홀더를 둬서 레이아웃이 튀지 않게 한다 */}
        <div ref={containerRef} className="overflow-hidden rounded-md [color-scheme:light]" style={{ minHeight: 40 }} />
        {!ready && !error && (
          <div className="absolute inset-0 flex h-10 items-center justify-center rounded-md border border-hairline bg-canvas">
            <Spinner className="h-4 w-4 text-muted" />
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 flex h-10 items-center justify-center gap-xs rounded-md border border-hairline bg-canvas">
            <Spinner className="h-4 w-4 text-ink" />
            <span className="text-body-sm text-muted">로그인 중…</span>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-sm rounded-md bg-error/10 px-sm py-xs text-body-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
