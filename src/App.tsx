import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { RedirectIfAuthenticated, RequireAuth } from '@/components/layout/RouteGuards'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { Spinner } from '@/components/ui/Button'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'))
const ProjectLayout = lazy(() => import('@/pages/ProjectLayout'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const MeetingListPage = lazy(() => import('@/pages/MeetingListPage'))
const MeetingNewPage = lazy(() => import('@/pages/MeetingNewPage'))
const MeetingDetailPage = lazy(() => import('@/pages/MeetingDetailPage'))
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage'))
const TaskBoardPage = lazy(() => import('@/pages/TaskBoardPage'))
const TaskDetailPage = lazy(() => import('@/pages/TaskDetailPage'))
const ProjectSettingsPage = lazy(() => import('@/pages/ProjectSettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-6 w-6 text-muted" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route element={<RedirectIfAuthenticated />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="meetings" element={<MeetingListPage />} />
              <Route path="meetings/new" element={<MeetingNewPage />} />
              <Route path="meetings/:meetingId" element={<MeetingDetailPage />} />
              <Route path="meetings/:meetingId/analysis" element={<AnalysisPage />} />
              <Route path="tasks" element={<TaskBoardPage />} />
              <Route path="tasks/:actionItemId" element={<TaskDetailPage />} />
              {/* 구성원은 설정 안으로 옮겼다. 예전 링크는 설정으로 보낸다. */}
              <Route path="members" element={<Navigate to="../settings" replace />} />
              <Route path="settings" element={<ProjectSettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
