import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/features/auth/AuthContext'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().min(1, '이메일을 입력해 주세요.').email('이메일 형식이 올바르지 않습니다.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/projects'

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values.email, values.password)
      navigate(redirectTo, { replace: true })
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  const fillDemo = () => {
    setValue('email', 'test@followup.com')
    setValue('password', '1111qqqq!')
  }

  return (
    <AuthLayout
      title="다시 오신 걸 환영합니다"
      description="이메일과 비밀번호로 로그인하세요."
      footer={
        <>
          아직 계정이 없으신가요?{' '}
          <Link to="/signup" className="font-semibold text-ink underline underline-offset-2">
            회원가입
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
        <FormRow label="이메일" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            invalid={!!errors.email}
            {...register('email')}
          />
        </FormRow>
        <FormRow label="비밀번호" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormRow>

        {serverError && (
          <p className="rounded-md bg-error/10 px-sm py-xs text-body-sm text-error" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          로그인
        </Button>
        <Button type="button" variant="secondary" size="md" fullWidth onClick={fillDemo}>
          테스트 계정 채우기
        </Button>
      </form>
    </AuthLayout>
  )
}
