import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Mail } from 'lucide-react'
import * as invitationApi from '@/api/invitationApi'
import { errorMessage } from '@/api/client'
import { Button, ButtonLink, Spinner } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { clearPendingInvite, savePendingInvite } from '@/features/members/pendingInvite'
import { qk } from '@/lib/queryKeys'
import { AuthLayout } from './AuthLayout'

/**
 * 초대 메일의 링크로 들어오는 화면.
 *
 * 로그인 전에도 "어느 프로젝트에 초대받았는지" 는 보여준다. 수락은 로그인해야 할 수 있고,
 * 계정이 없으면 가입 후 이 화면으로 돌아온다.
 */
export default function InviteAcceptPage() {
  const { token = '' } = useParams()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  // 로그인하러 갔다가 다른 화면으로 떨어져도 수락할 수 있도록 토큰을 적어 둔다.
  useEffect(() => {
    if (token) savePendingInvite(token)
  }, [token])

  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => invitationApi.previewInvitation(token),
    enabled: token.length > 0,
    retry: false,
  })

  const back = `/invite/${token}`

  const accept = useCallback(async () => {
    setAccepting(true)
    setError(null)
    try {
      const res = await invitationApi.acceptInvitation(token)
      clearPendingInvite()
      // 새로 들어간 프로젝트가 목록과 구성원에 바로 보이도록 캐시를 비운다.
      await qc.invalidateQueries({ queryKey: qk.projects })
      if (res?.projectId) await qc.invalidateQueries({ queryKey: qk.members(res.projectId) })
      navigate(res?.projectId ? `/projects/${res.projectId}` : '/projects', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setAccepting(false)
    }
  }, [token, qc, navigate])

  /*
   * 로그인만 되어 있으면 버튼을 한 번 더 누르게 하지 않는다.
   *
   * 메일 링크로 들어와 가입·로그인을 마치고 돌아온 사람은 이미 "수락" 의 뜻을 밝힌 것이다.
   * 초대받은 주소와 같은 계정일 때만 자동으로 수락하고, 다르면 아래에서 이유를 보여준다.
   */
  const data = preview.data
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current || !isAuthenticated || !data) return
    if (data.status !== 'PENDING') return
    if (user?.email && data.email && user.email.toLowerCase() !== data.email.toLowerCase()) return
    autoRan.current = true
    void accept()
  }, [isAuthenticated, data, user?.email, accept])

  if (preview.isLoading) {
    return (
      <AuthLayout title="초대를 확인하는 중입니다" description="잠시만 기다려 주세요.">
        <div className="flex justify-center py-xl">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      </AuthLayout>
    )
  }

  if (preview.isError || !preview.data) {
    return (
      <AuthLayout
        title="초대를 찾을 수 없습니다"
        description="링크가 만료됐거나 취소된 초대입니다. 초대한 분께 다시 보내 달라고 요청해 주세요."
      >
        <ButtonLink to="/" fullWidth size="lg">
          처음으로
        </ButtonLink>
      </AuthLayout>
    )
  }

  const invitation = preview.data
  const done = invitation.status === 'ACCEPTED'
  const dead = invitation.status === 'CANCELLED' || invitation.status === 'EXPIRED'
  // 초대받은 주소와 다른 계정으로 로그인해 둔 경우
  const mismatch =
    isAuthenticated && !!user?.email && user.email.toLowerCase() !== invitation.email.toLowerCase()

  return (
    <AuthLayout
      title={`${invitation.projectName} 에 초대받았습니다`}
      description={
        invitation.invitedByName
          ? `${invitation.invitedByName} 님이 ${invitation.email} 로 초대를 보냈습니다.`
          : `${invitation.email} 로 초대가 왔습니다.`
      }
    >
      <div className="flex flex-col gap-md">
        {dead && (
          <p className="rounded-md bg-error/10 px-sm py-xs text-body-sm text-error" role="alert">
            {invitation.status === 'CANCELLED' ? '취소된 초대입니다.' : '초대가 만료되었습니다.'} 초대한 분께 다시
            보내 달라고 요청해 주세요.
          </p>
        )}

        {done && (
          <p className="flex items-center gap-xxs text-body-sm text-success">
            <Check size={16} aria-hidden />
            이미 수락한 초대입니다.
          </p>
        )}

        {!dead && !done && !isAuthenticated && (
          <>
            {/* 아이콘은 글 안에 넣는다 — 문단을 flex 로 만들면 이메일이 한 글자씩 접힌다. */}
            <p className="rounded-md bg-surface-soft px-sm py-sm text-body-sm leading-relaxed text-muted">
              <Mail size={16} className="mr-xxs inline align-[-3px]" aria-hidden />
              수락하려면 <b className="font-semibold text-ink">{invitation.email}</b> 계정으로 로그인해 주세요.
              계정이 없다면 가입한 뒤 자동으로 이 프로젝트에 합류합니다.
            </p>
            <Link to="/login" state={{ from: back }}>
              <Button size="lg" fullWidth>
                로그인하고 수락하기
              </Button>
            </Link>
            <Link to="/signup" state={{ from: back }}>
              <Button size="lg" variant="secondary" fullWidth>
                회원가입
              </Button>
            </Link>
          </>
        )}

        {!dead && !done && isAuthenticated && (
          <>
            {mismatch && (
              <p className="rounded-md bg-error/10 px-sm py-xs text-body-sm text-error" role="alert">
                지금 <b className="font-semibold">{user?.email}</b> 로 로그인돼 있습니다. 초대는{' '}
                <b className="font-semibold">{invitation.email}</b> 로 왔습니다. 초대받은 계정으로 다시 로그인해
                주세요.
              </p>
            )}
            <Button size="lg" fullWidth loading={accepting} disabled={mismatch} onClick={() => void accept()}>
              초대 수락
            </Button>
          </>
        )}

        {error && (
          <p className="rounded-md bg-error/10 px-sm py-xs text-body-sm text-error" role="alert">
            {error}
          </p>
        )}

        {(done || dead) && (
          <ButtonLink to="/projects" variant="secondary" size="lg" fullWidth>
            내 프로젝트로
          </ButtonLink>
        )}
      </div>
    </AuthLayout>
  )
}
