import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { Button } from '@/components/ui/Button'
import { FormRow, Input } from '@/components/ui/Field'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/features/auth/AuthContext'
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

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', passwordConfirm: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      // 회원가입 성공 후 곧바로 로그인까지 처리한다.
      await signup(values.name, values.email, values.password)
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
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            invalid={!!errors.email}
            {...register('email')}
          />
        </FormRow>
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

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          회원가입
        </Button>
      </form>

      <GoogleLoginButton />
    </AuthLayout>
  )
}
