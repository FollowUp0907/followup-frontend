import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Calendar, CheckSquare, LayoutDashboard, Settings, Users } from 'lucide-react'
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
    { to: `${base}/members`, label: '구성원', icon: Users },
    { to: `${base}/settings`, label: '설정', icon: Settings },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* 시안: 64px 한 줄에 심볼 · 구분선 · 탭 · 아바타 */}
      <TopNav variant="app">
        <NavPillGroup items={items} />
      </TopNav>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1080px] px-lg py-xxl">
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
