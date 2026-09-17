export const qk = {
  projects: ['projects'] as const,
  project: (id: number) => ['project', id] as const,
  members: (projectId: number) => ['project', projectId, 'members'] as const,
  meetings: (projectId: number) => ['project', projectId, 'meetings'] as const,
  meeting: (meetingId: number) => ['meeting', meetingId] as const,
  actionItems: (projectId: number, filters?: unknown) => ['project', projectId, 'action-items', filters ?? {}] as const,
  actionItem: (id: number) => ['action-item', id] as const,
  dashboard: (projectId: number) => ['project', projectId, 'dashboard'] as const,
  analysis: (id: number) => ['analysis', id] as const,
  notifications: ['notifications'] as const,
}
