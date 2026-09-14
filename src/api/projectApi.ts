import { api } from './client'
import type {
  ProjectCreateReqDto,
  ProjectMemberCreateReqDto,
  ProjectMemberResDto,
  ProjectResDto,
  ProjectUpdateReqDto,
} from '@/types/api'

/** 주의: 목록만 복수형(/api/projects), 나머지는 단수형(/api/project) */
export const listProjects = () => api.get<ProjectResDto[]>('/api/projects').then((r) => r.data)

export const createProject = (data: ProjectCreateReqDto) =>
  api.post<ProjectResDto>('/api/project', data).then((r) => r.data)

export const getProject = (projectId: number) => api.get<ProjectResDto>(`/api/project/${projectId}`).then((r) => r.data)

export const updateProject = (projectId: number, data: ProjectUpdateReqDto) =>
  api.patch<ProjectResDto>(`/api/project/${projectId}`, data).then((r) => r.data)

export const deleteProject = (projectId: number) => api.delete<void>(`/api/project/${projectId}`).then((r) => r.data)

/* ---------- 멤버 ---------- */
export const listMembers = (projectId: number) =>
  api.get<ProjectMemberResDto[]>(`/api/project/${projectId}/members`).then((r) => r.data)

export const addMember = (projectId: number, data: ProjectMemberCreateReqDto) =>
  api.post<ProjectMemberResDto>(`/api/project/${projectId}/member`, data).then((r) => r.data)

export const removeMember = (projectId: number, userId: number) =>
  api.delete<void>(`/api/project/${projectId}/member/${userId}`).then((r) => r.data)
