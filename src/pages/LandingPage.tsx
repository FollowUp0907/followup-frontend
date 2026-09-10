import type { ReactNode } from 'react'
import { Check, CheckSquare, ChevronDown, ChevronsUp, Equal, FileText, RefreshCw, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TopNav } from '@/components/layout/TopNav'
import { Footer } from '@/components/layout/Footer'
import { Logo } from '@/components/layout/Logo'
import { Avatar } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/lib/cn'

const STEPS: Array<{ icon: LucideIcon; title: string; desc: string }> = [
  {
    icon: FileText,
    title: '회의록을 붙여넣어요',
    desc: '형식 걱정 없이 편하게 적은 회의 메모를 그대로 붙여넣으면 돼요.',
  },
  {
    icon: Sparkles,
    title: 'AI가 정리해요',
    desc: '결정 사항과 담당자별 후속 업무, 마감일을 자동으로 뽑아내요.',
  },
  {
    icon: CheckSquare,
    title: '검토하고 확정해요',
    desc: '필요한 부분만 수정하면 실제 업무로 바로 반영돼요.',
  },
]

const FEATURES: Array<{ icon: LucideIcon; title: string; desc: string }> = [
  {
    icon: Sparkles,
    title: '회의록에서 결정 사항만 골라내요',
    desc: '길게 늘어진 회의 메모에서 실제로 결정된 내용과 다음 행동을 구분해서 정리해요.',
  },
  {
    icon: CheckSquare,
    title: '후속 업무가 자동으로 만들어져요',
    desc: '담당자, 마감일, 우선순위까지 AI가 초안을 잡고, 사람이 검토만 하면 돼요.',
  },
  {
    icon: Users,
    title: '담당자별 진행 상황이 보여요',
    desc: '누가 무엇을 맡았고 얼마나 끝냈는지 대시보드에서 한눈에 확인해요.',
  },
  {
    icon: RefreshCw,
    title: '다음 회의로 자연스럽게 이어져요',
    desc: '지난 회의에서 끝내지 못한 업무가 다음 회의 작성 화면에 그대로 노출돼요.',
  },
]

const PLANS = [
  {
    name: '무료',
    price: '₩0',
    desc: '개인이나 소규모 팀이 가볍게 시작하기 좋아요.',
    cta: '무료로 시작하기',
    features: ['프로젝트 1개', '구성원 최대 5명', '회의 기록 무제한', 'AI 분석 월 20회'],
    featured: false,
  },
  {
    name: '팀',
    price: '₩12,000',
    period: '/ 인당 월',
    desc: '여러 프로젝트를 동시에 운영하는 팀을 위한 요금제예요.',
    cta: '팀으로 시작하기',
    features: ['프로젝트 무제한', '구성원 무제한', 'AI 분석 무제한', '업무 보드 · 필터'],
    featured: true,
  },
  {
    name: '엔터프라이즈',
    price: '문의',
    desc: '보안, 권한, 온프레미스 등 맞춤 요건이 있는 조직을 위해서예요.',
    cta: '문의하기',
    features: ['SSO · 감사 로그', '전담 지원', '맞춤 온보딩'],
    featured: false,
  },
]

function BrowserFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mx-auto w-full overflow-hidden rounded-xl border border-hairline bg-canvas',
        'shadow-[0_20px_60px_-20px_rgba(17,17,17,0.18)]',
        className,
      )}
    >
      <div className="flex h-9 items-center gap-xxs border-b border-hairline-soft px-md">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-pill bg-surface-strong" />
        ))}
      </div>
      <div className="p-lg">{children}</div>
    </div>
  )
}

function MiniKanbanMockup() {
  const cols = [
    {
      label: '예정',
      dot: '#898989',
      cards: [
        { t: '회원가입 UI', who: '김', Icon: ChevronDown, color: '#3b82f6' },
        { t: 'DB 설계', who: '최', Icon: Equal, color: '#f59e0b' },
      ],
    },
    {
      label: '진행 중',
      dot: '#3b82f6',
      cards: [
        {
          t: '로그인 오류 수정',
          who: '반',
          Icon: ChevronsUp,
          color: '#ef4444',
        },
      ],
    },
    {
      label: '완료',
      dot: '#10b981',
      cards: [{ t: 'ERD 작성', who: '최', Icon: ChevronDown, color: '#3b82f6' }],
    },
  ]
  return (
    <div>
      <div className="mb-md flex items-center gap-sm">
        <Logo variant="symbol" height={16} />
        <div className="flex gap-xxs rounded-pill bg-surface-soft p-[3px]">
          {['대시보드', '회의', '후속 업무'].map((t, i) => (
            <span
              key={t}
              className={cn(
                'rounded-pill px-sm py-[4px] text-[11px] font-medium',
                i === 2 ? 'bg-canvas text-ink shadow-pill' : 'text-muted',
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-sm">
        {cols.map((col) => (
          <div key={col.label} className="rounded-md bg-surface-soft p-xs">
            <div className="flex items-center gap-xxs px-xxs pb-xs pt-[2px]">
              <span className="h-1.5 w-1.5 rounded-pill" style={{ background: col.dot }} />
              <span className="text-[11px] font-semibold text-ink">{col.label}</span>
            </div>
            <div className="flex flex-col gap-xxs">
              {col.cards.map((c) => (
                <div key={c.t} className="rounded-md border border-hairline bg-canvas p-xs">
                  <div className="mb-xs text-[11px] font-medium text-ink">{c.t}</div>
                  <div className="flex items-center justify-between">
                    <c.Icon size={11} strokeWidth={2.5} style={{ color: c.color }} />
                    <Avatar name={c.who} size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniAIReviewMockup() {
  const rows = [
    {
      title: '로그인 오류 재현 및 원인 분석',
      reason: '사용자 리포트가 이미 접수돼 최우선 처리가 필요해요.',
      Icon: ChevronsUp,
      color: '#ef4444',
    },
    {
      title: '회원가입 UI 시안 작성',
      reason: '다른 화면 개발의 선행 조건이에요.',
      Icon: Equal,
      color: '#f59e0b',
    },
  ]
  return (
    <div>
      <div className="mb-md flex items-center gap-xs">
        <Sparkles size={14} className="text-ink" />
        <span className="text-body-sm font-semibold text-ink">AI 분석 결과 · 검토 후 확정해주세요</span>
      </div>
      <div className="mb-sm rounded-md bg-surface-card p-md">
        <div className="mb-xxs text-[11px] font-semibold text-muted">결정 사항</div>
        <div className="text-caption font-normal text-body">로그인 화면 오류는 이번 주 내 우선 수정한다.</div>
      </div>
      <div className="flex flex-col gap-xs">
        {rows.map((r) => (
          <div key={r.title} className="rounded-md border border-hairline bg-canvas p-sm">
            <div className="mb-xxs flex items-center gap-xxs">
              <r.Icon size={12} strokeWidth={2.5} style={{ color: r.color }} />
              <span className="text-caption font-semibold text-ink">{r.title}</span>
            </div>
            <div className="rounded-sm bg-surface-soft px-xs py-[5px] text-[11px] text-muted-soft">
              AI 추천 이유: {r.reason}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const primaryCta = isAuthenticated ? '/projects' : '/signup'

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav variant="marketing" />

      <main className="flex-1">
        {/* 히어로 — 시안은 가운데 정렬 + 브라우저 프레임 목업 */}
        <section className="px-lg pt-[88px] text-center">
          <h1 className="mx-auto max-w-[620px] text-[36px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink sm:text-[48px]">
            회의는 끝나도, 할 일은 남아있어요
          </h1>
          <p className="mx-auto mt-lg max-w-[480px] text-[17px] leading-relaxed text-muted">
            FollowUp이 회의록을 읽고 결정 사항과 담당자별 후속 업무를 정리해드려요. 다음 회의까지 놓치는 일 없이
            이어져요.
          </p>
          <div className="mt-xxl flex justify-center gap-sm">
            <ButtonLink to={primaryCta} size="lg">
              {isAuthenticated ? '내 프로젝트로' : '무료로 시작하기'}
            </ButtonLink>
            {!isAuthenticated && (
              <ButtonLink to="/login" variant="secondary" size="lg">
                로그인
              </ButtonLink>
            )}
          </div>
          <div className="py-[88px]">
            <BrowserFrame className="max-w-[880px]">
              <MiniKanbanMockup />
            </BrowserFrame>
          </div>
        </section>

        {/* 3단계 */}
        <section id="how" className="mx-auto max-w-[900px] px-lg pb-[96px]">
          <div className="grid gap-xl sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="text-center">
                <span className="mx-auto mb-md flex h-11 w-11 items-center justify-center rounded-pill border-[1.5px] border-hairline text-ink">
                  <s.icon size={19} />
                </span>
                <div className="text-title-md text-ink">{s.title}</div>
                <p className="mx-auto mt-xs max-w-[240px] text-body-sm leading-relaxed text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 기능 */}
        <section id="features" className="mx-auto max-w-[960px] px-lg pb-[96px]">
          <h2 className="text-center text-display-sm text-ink md:text-display-md">회의 하나로 끝나지 않게 만들어요</h2>
          <p className="mx-auto mb-xxl mt-sm max-w-[480px] text-center text-body-md leading-relaxed text-muted">
            회의는 잘 끝났는데 업무는 왜 흐지부지될까요. FollowUp은 그 사이의 빈틈을 메워요.
          </p>
          <div className="mb-xxl grid gap-lg sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-xl">
                <span className="mb-lg flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-canvas text-ink">
                  <f.icon size={17} />
                </span>
                <div className="text-title-md text-ink">{f.title}</div>
                <p className="mt-xs text-body-sm leading-relaxed text-muted">{f.desc}</p>
              </Card>
            ))}
          </div>
          <BrowserFrame className="max-w-[620px]">
            <MiniAIReviewMockup />
          </BrowserFrame>
        </section>

        {/* 요금제 */}
        <section id="pricing" className="mx-auto max-w-[900px] px-lg pb-[96px]">
          <h2 className="text-center text-display-sm text-ink md:text-display-md">팀 규모에 맞게 시작하세요</h2>
          <p className="mb-xxl mt-sm text-center text-body-md text-muted">언제든 변경할 수 있어요.</p>
          <div className="grid gap-lg md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'flex flex-col rounded-xl p-xl',
                  plan.featured ? 'bg-surface-dark text-on-dark' : 'border border-hairline bg-canvas text-ink',
                )}
              >
                <div className="text-title-md">{plan.name}</div>
                <p
                  className={cn(
                    'mb-lg mt-xxs min-h-[36px] text-body-sm leading-relaxed',
                    plan.featured ? 'text-on-dark-soft' : 'text-muted',
                  )}
                >
                  {plan.desc}
                </p>
                <div className="mb-xl flex items-baseline gap-xxs">
                  <span className="text-display-sm">{plan.price}</span>
                  {plan.period && (
                    <span className={cn('text-body-sm', plan.featured ? 'text-on-dark-soft' : 'text-muted')}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <ButtonLink
                  to={primaryCta}
                  fullWidth
                  className={cn('mb-xl', plan.featured ? 'border-none bg-on-dark text-ink' : '')}
                  variant={plan.featured ? 'secondary' : 'secondary'}
                >
                  {plan.cta}
                </ButtonLink>
                <ul className="flex flex-col gap-xs">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={cn(
                        'flex items-center gap-xs text-body-sm',
                        plan.featured ? 'text-on-dark-soft' : 'text-body',
                      )}
                    >
                      <Check size={14} className={plan.featured ? 'text-on-dark' : 'text-ink'} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA 배너 */}
        <section className="px-lg pb-[96px]">
          <div className="mx-auto max-w-[900px] rounded-xl bg-surface-card px-lg py-[56px] text-center">
            <h2 className="text-display-sm text-ink">다음 회의부터 바로 시작해보세요</h2>
            <p className="mt-sm text-body-sm text-muted">카드 등록 없이 무료로 시작할 수 있어요.</p>
            <ButtonLink to={primaryCta} size="lg" className="mt-xl">
              {isAuthenticated ? '내 프로젝트로' : '무료로 시작하기'}
            </ButtonLink>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
