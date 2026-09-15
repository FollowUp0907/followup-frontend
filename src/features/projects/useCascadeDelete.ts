import { useQueryClient } from '@tanstack/react-query'
import * as actionItemApi from '@/api/actionItemApi'
import * as meetingApi from '@/api/meetingApi'
import * as projectApi from '@/api/projectApi'
import { ApiError } from '@/api/client'
import { qk } from '@/lib/queryKeys'

/**
 * 연쇄 삭제.
 *
 * 백엔드는 연관 데이터가 남아 있으면 삭제를 거부한다. (2026-09-15 실측)
 *   DELETE /api/project/{id}  -> 409 PROJECT_DELETE_CONFLICT
 *   DELETE /api/meeting/{id}  -> 후속 업무만 있으면 204,
 *                                AI 분석/결정 이력이 있으면 409 (명세)
 * 그래서 화면에서 딸린 데이터를 먼저 지우고 마지막에 본체를 지운다.
 *
 * 분석·결정 사항은 삭제 API 자체가 없어서 프론트에서 치울 수 없다.
 * 그 경우는 409 를 그대로 사용자에게 설명한다.
 * → 백엔드가 cascade 로 지워 주면 이 파일은 통째로 지울 수 있다.
 */

/** 여러 건을 지우면서 실패한 건 모아 둔다. 한 건 실패로 전체가 멈추지 않게. */
async function deleteAll<T>(items: T[], remove: (item: T) => Promise<unknown>) {
  const failed: T[] = []
  for (const item of items) {
    try {
      await remove(item)
    } catch {
      failed.push(item)
    }
  }
  return failed
}

export function useCascadeDelete(projectId: number) {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project', projectId, 'action-items'] })
    qc.invalidateQueries({ queryKey: qk.meetings(projectId) })
    qc.invalidateQueries({ queryKey: qk.dashboard(projectId) })
  }

  /**
   * 회의 삭제.
   *
   * 후속 업무는 건드리지 않는다. 업무는 회의보다 오래 살아야 한다 —
   * 회의는 지나간 사건의 기록이고, 업무는 아직 진행 중인 일이다.
   * 회의에 딸린 결정 사항·분석 이력을 지우는 건 백엔드 몫이다.
   */
  const deleteMeetingCascade = async (meetingId: number) => {
    try {
      await meetingApi.deleteMeeting(meetingId)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        throw new ApiError(
          'AI 분석 이력이 남아 있어 이 회의는 삭제할 수 없습니다. (분석 기록은 백엔드에서만 지울 수 있습니다)',
          409,
        )
      }
      throw e
    }
    invalidate()
  }

  /** 프로젝트 삭제 — 후속 업무 → 회의 → 프로젝트 순으로 지운다. */
  const deleteProjectCascade = async () => {
    const [items, meetings] = await Promise.all([
      actionItemApi.listActionItems(projectId),
      meetingApi.listMeetings(projectId),
    ])

    const failedItems = await deleteAll(items, (i) => actionItemApi.deleteActionItem(i.id))
    const failedMeetings = await deleteAll(meetings, (m) => meetingApi.deleteMeeting(m.id))

    try {
      await projectApi.deleteProject(projectId)
    } catch (e) {
      invalidate()
      if (e instanceof ApiError && e.status === 409) {
        const stuck = failedMeetings.length
        throw new ApiError(
          stuck > 0
            ? `회의 ${stuck}건에 AI 분석 이력이 남아 있어 프로젝트를 삭제할 수 없습니다. (분석 기록은 백엔드에서만 지울 수 있습니다)`
            : '남아 있는 연관 데이터가 있어 프로젝트를 삭제할 수 없습니다.',
          409,
        )
      }
      throw e
    }

    qc.invalidateQueries({ queryKey: qk.projects })
    return {
      deletedActionItems: items.length - failedItems.length,
      deletedMeetings: meetings.length - failedMeetings.length,
    }
  }

  return { deleteMeetingCascade, deleteProjectCascade }
}
