import { Link } from 'react-router-dom'
import { Logo } from './Logo'

const COLUMNS: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
  {
    title: '제품',
    links: [
      { label: 'AI 회의록 분석', to: '/' },
      { label: '후속 업무 보드', to: '/' },
      { label: '프로젝트 대시보드', to: '/' },
      { label: '다음 회의 연결', to: '/' },
    ],
  },
  {
    title: '사용 사례',
    links: [
      { label: '개발팀 스프린트', to: '/' },
      { label: '기획 회의', to: '/' },
      { label: '주간 정기 회의', to: '/' },
      { label: '고객사 미팅', to: '/' },
    ],
  },
  {
    title: '리소스',
    links: [
      { label: 'API 문서 (Swagger)', to: '/' },
      { label: '릴리스 노트', to: '/' },
      { label: '도움말', to: '/' },
    ],
  },
  {
    title: '회사',
    links: [
      { label: '소개', to: '/' },
      { label: '문의하기', to: '/' },
      { label: '이용약관', to: '/' },
    ],
  },
]

/** 모든 페이지를 닫는 유일한 다크 서피스 */
export function Footer() {
  return (
    <footer className="bg-surface-dark">
      <div className="container-content py-[64px]">
        <div className="grid gap-xl md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo dark />
            <p className="mt-md max-w-[220px] text-body-sm text-on-dark-soft">
              회의가 끝나는 순간, 후속 업무가 시작됩니다.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="mb-md text-title-sm text-on-dark">{col.title}</p>
              <ul className="flex flex-col gap-sm">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-body-sm text-on-dark-soft">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-xxl border-t border-white/10 pt-lg">
          <p className="text-body-sm text-muted-soft">
            © {new Date().getFullYear()} FollowUp — 장은호 · 반서현 팀 프로젝트
          </p>
        </div>
      </div>
    </footer>
  )
}
