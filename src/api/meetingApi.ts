import { api } from './client'
import type { MeetingCreateReqDto, MeetingDetailResDto, MeetingListResDto, MeetingUpdateReqDto } from '@/types/api'

export const listMeetings = (projectId: number) =>
  api.get<MeetingListResDto[]>(`/api/project/${projectId}/meetings`).then((r) => r.data)

export const createMeeting = (projectId: number, data: MeetingCreateReqDto) =>
  api.post<MeetingDetailResDto>(`/api/project/${projectId}/meeting`, data).then((r) => r.data)

export const getMeeting = (meetingId: number) =>
  api.get<MeetingDetailResDto>(`/api/meeting/${meetingId}`).then((r) => r.data)

export const updateMeeting = (meetingId: number, data: MeetingUpdateReqDto) =>
  api.patch<MeetingDetailResDto>(`/api/meeting/${meetingId}`, data).then((r) => r.data)

export const deleteMeeting = (meetingId: number) =>
  api.delete<void>(`/api/meeting/${meetingId}`).then((r) => r.data)
