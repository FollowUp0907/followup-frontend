import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Calendar, CheckSquare, LayoutDashboard, Settings } from 'lucide-react'
import { TopNav } from '@/components/layout/TopNav'
import { NavPillGroup } from '@/components/ui/NavPillGroup'
import { EmptyState, Skeleton } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { errorMessage } from '@/api/client'
import { ProjectProvider } from '@/features/projects/ProjectContext'
import { useProject } from '@/features/projects/queries'

export default function ProjectLayout() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { data: project, isLoading, isError, error } = useProject(projectId)

  if (!Number.isFinite(projectId) || projectId <= 0) {
    return <Navigate to="/projects" replace />
  }

  const base = `/projects/${projectId}`
  const items = [
    { to: base, label: '대시보드', end: true, icon: LayoutDashboard },
    { to: `${base}/meetings`, label: '회의', icon: Calendar },
    { to: `${base}/tasks`, label: '후속 업무', icon: CheckSquare },
    // 구성원은 설정 안으로 들어갔다. 탭은 네 개로 유지한다.
    { to: `${base}/settings`, label: '설정', icon: Settings },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      {/* 시안: 64px 한 줄에 심볼 · 구분선 · 탭 · 아바타 */}
      <TopNav variant="app">
        <NavPillGroup items={items} />
      </TopNav>

      {/* 본문만 안에서 스크롤한다. 바깥(페이지 전체) 스크롤바는 생기지 않는다. */}
      <main className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1200px] px-lg py-xxl">
          {isLoading && (
            <div className="space-y-lg">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-[220px]" />
            </div>
          )}

          {isError && (
            <EmptyState
              title="프로젝트를 불러오지 못했습니다"
              description={errorMessage(error)}
              action={
                <ButtonLink to="/projects" variant="secondary">
                  프로젝트 목록으로
                </ButtonLink>
              }
            />
          )}

          {project && (
            <ProjectProvider project={project}>
              <Outlet />
            </ProjectProvider>
          )}
        </div>
      </main>
    </div>
  )
}
