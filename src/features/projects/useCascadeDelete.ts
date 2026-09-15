import { useQueryClient } from '@tanstack/react-query'
import * as actionItemApi from '@/api/actionItemApi'
import * as meetingApi from '@/api/meetingApi'
import * as projectApi from '@/api/projectApi'
import { ApiError } from '@/api/client'
import { qk } from '@/lib/queryKeys'

/**
 * 회의·프로젝트 삭제.
 *
 * 백엔드(2026-09-15)가 삭제를 정리해 주면서 프론트가 할 일이 거의 없어졌다.
 *   DELETE /api/meeting/{id}  -> 소프트 삭제. 결정사항·분석이력·업무 모두 유지
 *   DELETE /api/project/{id}  -> 하위 회의·결정사항·분석이력·업무까지 백엔드가 정리
 *
 * 다만 이 코드가 배포되는 시점에 백엔드가 아직 안 올라가 있을 수 있어,
 * 409 를 받으면 예전처럼 직접 치우고 다시 시도하는 경로를 남겨 뒀다.
 * → 백엔드가 EC2 에 반영된 것을 확인하면 fallback 을 지우고
 *   이 훅도 없앤 뒤 각 화면에서 api 를 직접 호출하면 된다.
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

  /** 회의 삭제 — 백엔드가 소프트 삭제로 처리한다. 후속 업무는 그대로 남는다. */
  const deleteMeetingCascade = async (meetingId: number) => {
    try {
      await meetingApi.deleteMeeting(meetingId)
    } catch (e) {
      // 구 백엔드에서만 나던 분기. 배포 후에는 발생하지 않는다.
      if (e instanceof ApiError && e.status === 409) {
        throw new ApiError('AI 분석 이력이 남아 있어 이 회의는 삭제할 수 없습니다.', 409)
      }
      throw e
    }
    invalidate()
  }

  /** 프로젝트 삭제 — 백엔드가 하위 데이터까지 정리한다. */
  const deleteProjectCascade = async () => {
    try {
      await projectApi.deleteProject(projectId)
    } catch (e) {
      // 구 백엔드: 연관 데이터가 남아 있으면 409. 직접 치우고 다시 시도한다.
      if (!(e instanceof ApiError) || e.status !== 409) throw e

      const [items, meetings] = await Promise.all([
        actionItemApi.listActionItems(projectId),
        meetingApi.listMeetings(projectId),
      ])
      await deleteAll(items, (i) => actionItemApi.deleteActionItem(i.id))
      const failedMeetings = await deleteAll(meetings, (m) => meetingApi.deleteMeeting(m.id))

      try {
        await projectApi.deleteProject(projectId)
      } catch (retryError) {
        invalidate()
        if (retryError instanceof ApiError && retryError.status === 409) {
          throw new ApiError(
            failedMeetings.length > 0
              ? `회의 ${failedMeetings.length}건을 지우지 못해 프로젝트를 삭제할 수 없습니다.`
              : '남아 있는 연관 데이터가 있어 프로젝트를 삭제할 수 없습니다.',
            409,
          )
        }
        throw retryError
      }
    }

    qc.invalidateQueries({ queryKey: qk.projects })
  }

  return { deleteMeetingCascade, deleteProjectCascade }
}
