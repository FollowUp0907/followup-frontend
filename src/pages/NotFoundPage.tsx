import { AppShell } from '@/components/layout/AppShell'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Card'

export default function NotFoundPage() {
  return (
    <AppShell>
      <EmptyState
        title="페이지를 찾을 수 없습니다"
        description="주소가 바뀌었거나 삭제된 페이지일 수 있습니다."
        action={<ButtonLink to="/projects">내 프로젝트로</ButtonLink>}
        className="py-section"
      />
    </AppShell>
  )
}
