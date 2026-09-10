import { Fragment } from 'react'
import { CheckSquare, FileText, Plus, Sparkles } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/layout/Logo'

const STEPS = [
  { icon: FileText, label: '회의록 작성' },
  { icon: Sparkles, label: 'AI 분석' },
  { icon: CheckSquare, label: '후속 업무 확정' },
]

/** 회의가 한 건도 없을 때 대시보드 자리를 채우는 온보딩 (시안 OnboardingEmptyState) */
export function OnboardingEmptyState({ newMeetingTo, membersTo }: { newMeetingTo: string; membersTo: string }) {
  return (
    <div className="mx-auto max-w-[560px] py-[60px] text-center">
      <div className="mx-auto mb-xl flex h-12 w-12 items-center justify-center rounded-lg bg-surface-card">
        <Logo variant="symbol" height={22} />
      </div>

      <h2 className="text-display-sm text-ink">첫 회의를 기록하고 후속 업무를 자동으로 만들어보세요</h2>
      <p className="mt-sm text-body-md leading-relaxed text-muted">
        회의록을 붙여넣기만 하면 AI가 결정 사항과 담당자별 후속 업무를 정리해드려요.
        <br />
        검토하고 확정하면 이 대시보드에 바로 반영돼요.
      </p>

      <div className="mt-xxl flex items-center justify-center">
        {STEPS.map((s, i) => (
          <Fragment key={s.label}>
            <div className="flex w-[110px] flex-col items-center gap-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-pill border-[1.5px] border-hairline bg-canvas text-ink">
                <s.icon size={18} />
              </span>
              <span className="text-caption text-muted">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className="mb-lg h-[1.5px] w-10 bg-hairline" aria-hidden />}
          </Fragment>
        ))}
      </div>

      <div className="mt-xxl flex flex-col items-center gap-sm">
        <ButtonLink to={newMeetingTo} size="lg">
          <Plus size={16} /> 첫 회의 만들기
        </ButtonLink>
        <ButtonLink to={membersTo} variant="ghost" size="sm">
          또는 구성원부터 초대하기
        </ButtonLink>
      </div>
    </div>
  )
}
