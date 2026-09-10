import { Link } from 'react-router-dom'
import { TopNav } from '@/components/layout/TopNav'
import { Footer } from '@/components/layout/Footer'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, SurfaceCard } from '@/components/ui/Card'
import { useAuth } from '@/features/auth/AuthContext'

const FEATURES = [
  {
    title: 'AI 회의록 분석',
    body: '회의록을 붙여 넣으면 결정 사항과 후속 업무, 담당자, 마감일, 우선순위를 한 번에 뽑아냅니다.',
  },
  {
    title: '초안 검토 후 확정',
    body: 'AI 결과를 바로 저장하지 않습니다. 수정·추가·삭제해서 확정한 내용만 실제 업무가 됩니다.',
  },
  {
    title: '다음 회의로 연결',
    body: '완료되지 않은 업무는 다음 회의를 만들 때 자동으로 따라옵니다. 회의가 끊기지 않습니다.',
  },
]

const STEPS = [
  { n: '01', title: '회의 만들기', body: '제목·날짜·참여자를 정하고 이전 회의의 미완료 업무를 확인합니다.' },
  { n: '02', title: '회의록 붙여 넣기', body: '형식은 자유입니다. 메모든 대화록이든 그대로 넣으세요.' },
  { n: '03', title: 'AI 분석 검토', body: '추출된 초안을 확인하고 담당자와 마감일을 확정합니다.' },
  { n: '04', title: '업무 보드에서 실행', body: '예정 → 진행 중 → 완료. 지연·마감 임박은 자동으로 표시됩니다.' },
]

const FAQ = [
  {
    q: 'AI가 잘못 추출하면 어떻게 하나요?',
    a: '분석 결과는 초안 상태로만 남습니다. 항목을 고치거나 지우고, AI가 놓친 업무를 직접 추가한 뒤 확정 버튼을 눌러야 실제 업무가 생성됩니다.',
  },
  {
    q: '이전 회의 업무는 어떻게 이어지나요?',
    a: '새 회의를 만들 때 아직 완료되지 않은 업무 목록이 표시되고, 선택한 업무가 회의에 연결됩니다. 회의 상세에서 진행 상황을 그대로 확인할 수 있습니다.',
  },
  {
    q: '팀원은 어떻게 초대하나요?',
    a: '프로젝트 구성원 화면에서 이메일로 추가합니다. 프로젝트를 만든 사람은 OWNER, 초대된 사람은 MEMBER 권한을 갖습니다.',
  },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const primaryCta = isAuthenticated ? '/projects' : '/signup'

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav variant="marketing" />

      <main className="flex-1">
        {/* 히어로 — 7/5 그리드 */}
        <section className="container-content grid items-center gap-xxl py-xxl lg:grid-cols-12 lg:py-section">
          <div className="lg:col-span-7">
            <Badge tone="neutral">회의 후속 업무 관리</Badge>
            <h1 className="mt-md text-[40px] font-semibold leading-[1.08] tracking-[-1.5px] text-ink sm:text-[52px] lg:text-display-xl">
              회의가 끝나면
              <br />
              업무가 시작됩니다
            </h1>
            <p className="mt-lg max-w-[520px] text-body-md text-muted">
              회의록을 입력하면 AI가 결정 사항과 해야 할 일, 담당자, 기한을 추출합니다. 검토하고 확정하면 그대로 업무
              보드가 되고, 남은 일은 다음 회의까지 따라옵니다.
            </p>
            <div className="mt-xl flex flex-wrap items-center gap-sm">
              <ButtonLink to={primaryCta} size="lg">
                {isAuthenticated ? '내 프로젝트로 이동' : '무료로 시작하기'}
              </ButtonLink>
              <ButtonLink to="/login" size="lg" variant="secondary">
                로그인
              </ButtonLink>
            </div>
            <p className="mt-md text-caption font-normal text-muted-soft">
              테스트 계정 · test@followup.com / 1111qqqq!
            </p>
          </div>

          {/* 제품 UI 조각을 그대로 보여주는 히어로 목업 */}
          <div className="lg:col-span-5">
            <SurfaceCard className="rounded-xl p-lg shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-caption text-muted">AI 분석 결과 · 초안</p>
                <Badge tone="info">GENERATED</Badge>
              </div>

              <div className="mt-md rounded-lg bg-surface-card p-md">
                <p className="text-caption text-muted">결정 사항</p>
                <p className="mt-xxs text-body-sm text-ink">검색 기능은 이번 버전에서 제외</p>
              </div>

              <div className="mt-sm rounded-lg border border-hairline p-md">
                <div className="flex items-start justify-between gap-sm">
                  <p className="text-title-sm text-ink">로그인 오류 수정</p>
                  <Badge tone="error">높음</Badge>
                </div>
                <dl className="mt-sm grid grid-cols-2 gap-sm text-caption">
                  <div>
                    <dt className="font-normal text-muted">담당자</dt>
                    <dd className="mt-xxs text-ink">반서현</dd>
                  </div>
                  <div>
                    <dt className="font-normal text-muted">마감일</dt>
                    <dd className="mt-xxs text-ink">2026.09.11</dd>
                  </div>
                </dl>
                <p className="mt-sm rounded-md bg-surface-soft px-sm py-xs text-caption font-normal text-muted">
                  AI 추천 이유 · 배포 전에 해결해야 하는 오류
                </p>
              </div>

              <div className="mt-sm rounded-lg border border-hairline p-md">
                <div className="flex items-start justify-between gap-sm">
                  <p className="text-title-sm text-ink">API 문서 정리</p>
                  <Badge tone="warning">보통</Badge>
                </div>
                <p className="mt-xs text-caption font-normal text-muted">장은호 · 2026.09.14</p>
              </div>

              <div className="mt-lg flex items-center justify-between gap-sm">
                <p className="text-caption font-normal text-muted-soft">확정 전에는 저장되지 않습니다</p>
                <span className="inline-flex h-10 items-center rounded-md bg-primary px-lg text-button text-on-primary">
                  확정하고 업무 생성
                </span>
              </div>
            </SurfaceCard>
          </div>
        </section>

        {/* 문제 정의 — 회색 카드 밴드 */}
        <section id="features" className="bg-canvas py-xxl lg:py-section">
          <div className="container-content">
            <h2 className="max-w-[720px] text-[32px] font-semibold leading-[1.15] tracking-[-1px] text-ink lg:text-display-lg">
              회의는 끝났는데,
              <br />
              일은 시작되지 않는 이유
            </h2>
            <p className="mt-md max-w-[560px] text-body-md text-muted">
              결정과 의견이 섞이고, 담당자가 불명확하고, 후속 업무가 메신저와 문서에 흩어집니다. FollowUp은 그 사이를
              메웁니다.
            </p>
            <div className="mt-xxl grid gap-lg md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title}>
                  <div className="mb-md inline-flex h-9 w-9 items-center justify-center rounded-md bg-canvas">
                    <span className="text-title-sm text-ink">·</span>
                  </div>
                  <h3 className="text-title-md text-ink">{f.title}</h3>
                  <p className="mt-xs text-body-md text-muted">{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 동작 방식 — 흰 배경 + 제품 카드 */}
        <section id="how" className="border-t border-hairline-soft py-xxl lg:py-section">
          <div className="container-content grid gap-xxl lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 className="text-[32px] font-semibold leading-[1.15] tracking-[-1px] text-ink lg:text-display-lg">
                네 단계면 끝납니다
              </h2>
              <p className="mt-md max-w-[420px] text-body-md text-muted">
                복잡한 설정 없이, 회의를 만들고 회의록을 넣는 것부터 시작하세요.
              </p>
              <div className="mt-xl">
                <ButtonLink to={primaryCta}>지금 시작하기</ButtonLink>
              </div>
            </div>
            <div className="lg:col-span-7">
              <ol className="grid gap-lg sm:grid-cols-2">
                {STEPS.map((s) => (
                  <li key={s.n} className="rounded-lg border border-hairline bg-canvas p-lg shadow-soft">
                    <p className="text-caption text-muted-soft">{s.n}</p>
                    <p className="mt-xs text-title-sm text-ink">{s.title}</p>
                    <p className="mt-xs text-body-sm text-muted">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 루프 — 회색 카드 밴드 */}
        <section id="loop" className="py-xxl lg:py-section">
          <div className="container-content">
            <Card className="p-xxl">
              <div className="grid gap-xl lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-5">
                  <h2 className="text-display-sm text-ink lg:text-display-md">회의 → 업무 → 다음 회의</h2>
                  <p className="mt-md text-body-md text-muted">
                    FollowUp의 핵심은 한 번의 요약이 아니라 반복되는 루프입니다. 남은 업무가 다음 회의로 이어지면서
                    프로젝트가 앞으로 굴러갑니다.
                  </p>
                </div>
                <div className="lg:col-span-7">
                  <div className="grid gap-sm sm:grid-cols-3">
                    {['예정', '진행 중', '완료'].map((col, i) => (
                      <div key={col} className="rounded-lg bg-canvas p-md">
                        <p className="mb-sm text-caption text-muted">{col}</p>
                        <div className="space-y-xs">
                          <div className="rounded-md border border-hairline px-sm py-xs text-caption font-normal text-ink">
                            {['회원가입 UI', '로그인 오류 수정', 'ERD 작성'][i]}
                          </div>
                          <div className="rounded-md border border-hairline px-sm py-xs text-caption font-normal text-ink">
                            {['DB 설계', 'API 연동', '프로젝트 생성'][i]}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-hairline-soft py-xxl lg:py-section">
          <div className="container-content grid gap-xxl lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-display-sm text-ink lg:text-display-md">자주 묻는 질문</h2>
            </div>
            <dl className="lg:col-span-8">
              {FAQ.map((item) => (
                <div key={item.q} className="border-b border-hairline-soft py-lg first:pt-0">
                  <dt className="text-title-md text-ink">{item.q}</dt>
                  <dd className="mt-xs text-body-md text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 프리풋터 CTA */}
        <section className="pb-xxl lg:pb-section">
          <div className="container-content">
            <Card className="p-xxl text-center">
              <h2 className="text-display-sm text-ink">회의록 하나로 시작해 보세요</h2>
              <p className="mx-auto mt-sm max-w-[520px] text-body-md text-muted">
                프로젝트를 만들고 지난 회의록을 붙여 넣으면, 몇 초 뒤에 후속 업무 목록이 만들어집니다.
              </p>
              <div className="mt-xl flex justify-center">
                <ButtonLink to={primaryCta} size="lg">
                  {isAuthenticated ? '내 프로젝트로 이동' : '무료로 시작하기'}
                </ButtonLink>
              </div>
              <p className="mt-md text-caption font-normal text-muted-soft">
                이미 계정이 있으신가요?{' '}
                <Link to="/login" className="text-ink underline underline-offset-2">
                  로그인
                </Link>
              </p>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
