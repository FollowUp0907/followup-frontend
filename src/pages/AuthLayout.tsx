import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
      {/* 좌: 브랜드 면 — 다크 서피스는 이 화면과 푸터에서만 쓴다 */}
      <aside className="hidden flex-col justify-between bg-surface-dark p-xxl lg:flex">
        {/* 로고를 누르면 소개 화면으로 — 로그인하다 말고 나가고 싶을 때가 있다. */}
        <Link to="/" aria-label="FollowUp 홈으로" className="w-fit">
          <Logo variant="full" height={20} className="text-on-dark" />
        </Link>
        <div>
          <h2 className="max-w-[420px] text-display-md text-on-dark">
            회의가 끝나는 순간,
            <br />
            후속 업무가 시작됩니다.
          </h2>
          <p className="mt-lg max-w-[380px] text-body-md text-on-dark-soft">
            회의록을 붙여 넣으면 AI가 결정 사항과 할 일, 담당자, 마감일을 뽑아냅니다. 검토하고 확정하면 그대로 업무
            보드가 됩니다.
          </p>
          <div className="mt-xl rounded-lg bg-surface-dark-elevated p-lg">
            <p className="text-caption text-on-dark-soft">회의록</p>
            <p className="mt-xs text-body-sm text-on-dark">
              “로그인 오류는 서현님이 금요일까지 수정하기로 했다. 배포는 다음 주 월요일.”
            </p>
            <div className="my-md h-px bg-white/10" />
            <p className="text-caption text-on-dark-soft">추출 결과</p>
            <ul className="mt-xs space-y-xxs text-body-sm text-on-dark">
              <li>· 로그인 오류 수정 — 반서현 · 금요일 · HIGH</li>
              <li>· 다음 주 월요일 배포</li>
            </ul>
          </div>
        </div>
        <p className="text-body-sm text-muted-soft">© {new Date().getFullYear()} FollowUp</p>
      </aside>

      <main className="flex flex-col justify-center bg-canvas px-lg py-xxl sm:px-xxl">
        <div className="mx-auto w-full max-w-[400px]">
          <Link to="/" aria-label="FollowUp 홈으로" className="mb-xl block w-fit lg:hidden">
            <Logo variant="full" height={20} />
          </Link>
          <h1 className="text-display-sm text-ink">{title}</h1>
          <p className="mt-xs text-body-md text-muted">{description}</p>
          <div className="mt-xl">{children}</div>
          {footer && <div className="mt-lg text-center text-body-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
