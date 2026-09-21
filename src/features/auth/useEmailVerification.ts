import { useCallback, useEffect, useState } from 'react'
import * as authApi from '@/api/authApi'
import { ApiError, errorMessage } from '@/api/client'

const CODE_LENGTH = 6
const DEFAULT_EXPIRES_IN = 300
const DEFAULT_RESEND_AFTER = 60

/*
 * 백엔드에 아직 인증 API 가 없을 때 돌아오는 상태들.
 *
 * 404/405/501 뿐 아니라 401·403 도 넣었다. 우리 백엔드(Spring Security)는
 * 매핑되지 않은 경로에 401 을 준다 — 실제로 /api/auth/아무거나 를 찔러 보면 401 이다.
 * 이 두 엔드포인트는 로그인 전에 부르는 곳이라, 401 이 "세션 만료" 일 수가 없다.
 */
const NOT_IMPLEMENTED = [401, 403, 404, 405, 501]

function secondsLeft(until: number | null, now: number) {
  if (!until) return 0
  return Math.max(0, Math.ceil((until - now) / 1000))
}

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export const VERIFICATION_CODE_LENGTH = CODE_LENGTH

/**
 * 회원가입 전 이메일 인증 상태.
 *
 * 메일로 받은 6자리 번호를 확인하면 일회용 토큰이 나오고, 그 토큰이 있어야 가입할 수 있다.
 * 이메일을 고치면 인증은 처음부터 다시 — 인증한 주소와 가입하는 주소가 달라지면 안 되기 때문이다.
 *
 * 백엔드에 아직 인증 API 가 없으면(404/405/501) `unavailable` 로 두고 인증 없이 가입하게 둔다.
 * 프론트와 백엔드 배포 순서를 맞추지 않아도 가입이 막히지 않도록 하기 위한 장치다.
 */
export function useEmailVerification() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // 남은 시간 표시가 필요한 동안에만 1초마다 다시 그린다.
  const ticking = (expiresAt !== null || resendAt !== null) && !token
  useEffect(() => {
    if (!ticking) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [ticking])
  const expiresIn = secondsLeft(expiresAt, now)
  const resendIn = secondsLeft(resendAt, now)
  const expired = sentTo !== null && !token && expiresAt !== null && expiresIn === 0

  const reset = useCallback(() => {
    setSentTo(null)
    setVerifiedEmail(null)
    setToken(null)
    setError(null)
    setNotice(null)
    setExpiresAt(null)
    setResendAt(null)
  }, [])

  const send = useCallback(async (email: string) => {
    const target = email.trim()
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      const res = await authApi.sendEmailVerification({ email: target })
      setNow(Date.now())
      setSentTo(target)
      setToken(null)
      setVerifiedEmail(null)
      setExpiresAt(Date.now() + (res.expiresIn ?? DEFAULT_EXPIRES_IN) * 1000)
      setResendAt(Date.now() + (res.resendAfter ?? DEFAULT_RESEND_AFTER) * 1000)
      setNotice(`${target} 로 인증번호를 보냈습니다. 메일함을 확인해 주세요.`)
      return true
    } catch (e) {
      if (e instanceof ApiError && NOT_IMPLEMENTED.includes(e.status)) {
        setUnavailable(true)
        return true
      }
      setError(errorMessage(e))
      return false
    } finally {
      setSending(false)
    }
  }, [])

  const confirm = useCallback(
    async (code: string) => {
      const target = sentTo
      if (!target) return false
      setVerifying(true)
      setError(null)
      setNotice(null)
      try {
        const res = await authApi.confirmEmailVerification({ email: target, code })
        setToken(res.verificationToken)
        setVerifiedEmail(target)
        setExpiresAt(null)
        setResendAt(null)
        return true
      } catch (e) {
        if (e instanceof ApiError && NOT_IMPLEMENTED.includes(e.status)) {
          setUnavailable(true)
          return true
        }
        setError(errorMessage(e))
        return false
      } finally {
        setVerifying(false)
      }
    },
    [sentTo],
  )

  return {
    /** 인증 API 가 없는 백엔드 — 인증 단계를 건너뛴다. */
    unavailable,
    /** 메일을 보낸 주소. 아직 안 보냈으면 null */
    sentTo,
    verifiedEmail,
    token,
    verified: !!token,
    sending,
    verifying,
    error,
    notice,
    /** 인증번호 남은 시간(초) */
    expiresIn,
    expired,
    /** 재발송까지 남은 시간(초) */
    resendIn,
    send,
    confirm,
    reset,
  }
}
