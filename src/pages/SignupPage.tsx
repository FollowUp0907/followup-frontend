import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { z } from 'zod'
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { Button } from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/features/auth/AuthContext'
import {
  VERIFICATION_CODE_LENGTH,
  formatCountdown,
  useEmailVerification,
} from '@/features/auth/useEmailVerification'
import { AuthLayout } from './AuthLayout'

const schema = z
  .object({
    name: z.string().min(1, '이름을 입력해 주세요.').max(50, '이름은 50자 이하로 입력해 주세요.'),
    email: z.string().min(1, '이메일을 입력해 주세요.').email('이메일 형식이 올바르지 않습니다.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다.',
  })
type FormValues = z.infer<typeof schema>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const verification = useEmailVerification()
  // 인증 API 가 없는 백엔드에서는 예전처럼 바로 가입되게 둔다.
  const gated = !verification.unavailable

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', passwordConfirm: '' },
  })

  const email = watch('email')
  const target = email.trim().toLowerCase()
  const emailValid = EMAIL_RE.test(email.trim())

  /*
   * 인증은 "그때 그 주소"에만 유효하다.
   * 그래서 인증 여부도, 인증번호 칸도, 남은 시간도 지금 입력된 주소와 맞을 때만 인정한다.
   * 이메일을 한 글자라도 고치면 자연히 처음 상태로 돌아간다.
   */
  const sentToThis = verification.sentTo?.trim().toLowerCase() === target && !!verification.sentTo
  const verified = !!verification.token && verification.verifiedEmail?.trim().toLowerCase() === target
  const awaitingCode = sentToThis && !verified
  const resendIn = sentToThis ? verification.resendIn : 0

  const codeRef = useRef<HTMLInputElement>(null)

  const sendCode = async () => {
    setServerError(null)
    setCode('')
    const ok = await verification.send(email)
    if (ok) window.setTimeout(() => codeRef.current?.focus(), 0)
  }

  const confirmCode = async () => {
    setServerError(null)
    await verification.confirm(code)
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    if (gated && !verified) {
      setServerError('이메일 인증을 먼저 완료해 주세요.')
      return
    }
    try {
      // 회원가입 성공 후 곧바로 로그인까지 처리한다.
      await signup(values.name, values.email, values.password, verified ? (verification.token ?? undefined) : undefined)
      navigate('/projects', { replace: true })
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  return (
    <AuthLayout
      title="계정 만들기"
      description="30초면 충분합니다. 팀 프로젝트를 만들고 회의록을 붙여 넣어 보세요."
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-semibold text-ink underline underline-offset-2">
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
        <FormRow label="이름" htmlFor="name" error={errors.name?.message}>
          <Input id="name" placeholder="장은호" autoComplete="name" invalid={!!errors.name} {...register('name')} />
        </FormRow>

        <FormRow label="이메일" htmlFor="email" error={errors.email?.message}>
          <div className="flex items-center gap-xs">
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              invalid={!!errors.email}
              className="flex-1"
              {...register('email')}
            />
            {gated && (
              <Button
                type="button"
                variant="secondary"
                className="h-10 shrink-0 whitespace-nowrap px-md"
                disabled={!emailValid || verified || resendIn > 0}
                loading={verification.sending}
                onClick={() => void sendCode()}
              >
                {verified
                  ? '인증 완료'
                  : resendIn > 0
                    ? `재발송 ${formatCountdown(resendIn)}`
                    : sentToThis
                      ? '재발송'
                      : '인증 메일 보내기'}
              </Button>
            )}
          </div>

          {gated && verified && (
            <p className="mt-xs flex items-center gap-xxs text-caption text-success">
              <Check size={14} aria-hidden />
              이메일 인증 완료
            </p>
          )}

          {gated && awaitingCode && verification.notice && (
            <p className="mt-xs text-caption text-muted">{verification.notice}</p>
          )}
        </FormRow>

        {/* 메일을 보낸 뒤에만 나타나는 칸 — 번호를 맞히면 가입 버튼이 열린다. */}
        {gated && awaitingCode && (
          <FormRow
            label="인증번호"
            htmlFor="verification-code"
            hint={`메일로 받은 ${VERIFICATION_CODE_LENGTH}자리`}
            error={verification.error ?? undefined}
          >
            <div className="flex items-center gap-xs">
              <Input
                ref={codeRef}
                id="verification-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={VERIFICATION_CODE_LENGTH}
                placeholder="000000"
                value={code}
                invalid={!!verification.error}
                className="flex-1 tracking-[0.4em]"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH))}
                onKeyDown={(e) => {
                  // 폼 전체가 제출되지 않도록 여기서 가로채 인증만 한다.
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (code.length === VERIFICATION_CODE_LENGTH) void confirmCode()
                  }
                }}
              />
              <span
                className={`w-12 shrink-0 text-right text-caption tabular-nums ${
                  verification.expired ? 'text-error' : 'text-muted'
                }`}
              >
                {verification.expired ? '만료' : formatCountdown(verification.expiresIn)}
              </span>
              <Button
                type="button"
                className="h-10 shrink-0 px-md"
                disabled={code.length !== VERIFICATION_CODE_LENGTH || verification.expired}
                loading={verification.verifying}
                onClick={() => void confirmCode()}
              >
                확인
              </Button>
            </div>
            {verification.expired && !verification.error && (
              <p className="mt-xs text-caption text-muted">
                인증번호가 만료되었습니다. 재발송을 눌러 새 번호를 받아 주세요.
              </p>
            )}
          </FormRow>
        )}

        {gated && !awaitingCode && verification.error && (
          <p className="rounded-md bg-error/10 px-sm py-xs text-body-sm text-error" role="alert">
            {verification.error}
          </p>
        )}

        <FormRow label="비밀번호" htmlFor="password" hint="8자 이상" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormRow>
        <FormRow label="비밀번호 확인" htmlFor="passwordConfirm" error={errors.passwordConfirm?.message}>
          <Input
            id="passwordConfirm"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            invalid={!!errors.passwordConfirm}
            {...register('passwordConfirm')}
          />
        </FormRow>

        {serverError && (
          <p className="rounded-md bg-error/10 px-sm py-xs text-body-sm text-error" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={gated && !verified}>
          회원가입
        </Button>
        {gated && !verified && (
          <p className="text-center text-caption text-muted">이메일 인증을 마치면 가입할 수 있습니다.</p>
        )}
      </form>

      <GoogleLoginButton />
    </AuthLayout>
  )
}
