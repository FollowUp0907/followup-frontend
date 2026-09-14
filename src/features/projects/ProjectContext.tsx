import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useMembers } from '@/features/members/queries'
import type { ProjectMemberResDto, ProjectResDto } from '@/types/api'

interface ProjectContextValue {
  projectId: number
  project: ProjectResDto
  members: ProjectMemberResDto[]
  membersLoading: boolean
  /** 현재 로그인 사용자가 이 프로젝트의 OWNER 인지 */
  isOwner: boolean
  memberName: (userId?: number | null) => string
  /** AI가 뽑은 담당자 "이름"을 실제 멤버 userId 로 매칭 (완전일치 → 포함관계 순) */
  matchMemberByName: (name?: string | null) => ProjectMemberResDto | undefined
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ project, children }: { project: ProjectResDto; children: ReactNode }) {
  const projectId = project.id
  const { user, syncName } = useAuth()
  const { data: members, isLoading } = useMembers(projectId)

  const list = useMemo(() => members ?? [], [members])

  // 백엔드에 /me 가 없어서, 멤버 목록에서 내 이름을 알아내 프로필에 채운다.
  useEffect(() => {
    const me = list.find((m) => m.userId === user?.userId)
    if (me?.name) syncName(me.name)
  }, [list, user?.userId, syncName])

  const value = useMemo<ProjectContextValue>(() => {
    const byId = new Map(list.map((m) => [m.userId, m]))
    return {
      projectId,
      project,
      members: list,
      membersLoading: isLoading,
      isOwner: list.some((m) => m.userId === user?.userId && m.role === 'OWNER'),
      memberName: (userId) => (userId ? (byId.get(userId)?.name ?? '알 수 없음') : '미지정'),
      matchMemberByName: (name) => {
        const q = name?.trim()
        if (!q) return undefined
        const exact = list.find((m) => m.name === q)
        if (exact) return exact
        const normalized = q.replace(/\s+/g, '')
        return list.find((m) => {
          const n = m.name.replace(/\s+/g, '')
          return n === normalized || n.includes(normalized) || normalized.includes(n)
        })
      },
    }
  }, [projectId, project, list, isLoading, user?.userId])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be used inside <ProjectProvider>')
  return ctx
}
