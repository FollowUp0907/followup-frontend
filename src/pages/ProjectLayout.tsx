import { Navigate, Outlet, useParams } from 'react-router-dom'
import { TopNav } from '@/components/layout/TopNav'
import { Footer } from '@/components/layout/Footer'
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
    { to: base, label: '대시보드', end: true },
    { to: `${base}/meetings`, label: '회의' },
    { to: `${base}/tasks`, label: '후속 업무' },
    { to: `${base}/members`, label: '구성원' },
    { to: `${base}/settings`, label: '설정' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav />

      <div className="border-b border-hairline-soft bg-canvas">
        <div className="container-content flex flex-wrap items-center justify-between gap-md py-md">
          <div className="min-w-0">
            <p className="text-caption font-normal text-muted-soft">프로젝트</p>
            <p className="truncate text-title-md text-ink">
              {isLoading ? <span className="inline-block h-5 w-40 animate-pulse rounded-sm bg-surface-card" /> : project?.name}
            </p>
          </div>
          <NavPillGroup items={items} />
        </div>
      </div>

      <main className="flex-1">
        <div className="container-content py-xxl">
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
              action={<ButtonLink to="/projects" variant="secondary">프로젝트 목록으로</ButtonLink>}
            />
          )}

          {project && (
            <ProjectProvider project={project}>
              <Outlet />
            </ProjectProvider>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
