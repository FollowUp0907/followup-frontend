import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as meetingApi from '@/api/meetingApi'
import { qk } from '@/lib/queryKeys'
import type { MeetingCreateReqDto, MeetingUpdateReqDto } from '@/types/api'

export function useMeetings(projectId: number) {
  return useQuery({
    queryKey: qk.meetings(projectId),
    queryFn: () => meetingApi.listMeetings(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  })
}

export function useMeeting(meetingId: number) {
  return useQuery({
    queryKey: qk.meeting(meetingId),
    queryFn: () => meetingApi.getMeeting(meetingId),
    enabled: Number.isFinite(meetingId) && meetingId > 0,
  })
}

export function useCreateMeeting(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MeetingCreateReqDto) => meetingApi.createMeeting(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meetings(projectId) })
      qc.invalidateQueries({ queryKey: qk.dashboard(projectId) })
    },
  })
}

export function useUpdateMeeting(projectId: number, meetingId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MeetingUpdateReqDto) => meetingApi.updateMeeting(meetingId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meeting(meetingId) })
      qc.invalidateQueries({ queryKey: qk.meetings(projectId) })
    },
  })
}

export function useDeleteMeeting(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meetingId: number) => meetingApi.deleteMeeting(meetingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meetings(projectId) })
      qc.invalidateQueries({ queryKey: qk.dashboard(projectId) })
      qc.invalidateQueries({ queryKey: qk.actionItems(projectId) })
    },
  })
}
