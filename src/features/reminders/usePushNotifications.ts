import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { subscribePush, unsubscribePush } from '@/api/pushApi'
import {
  currentPushToken,
  enablePush,
  isPushConfigured,
  isPushSupported,
  onPushMessage,
  pushPermission,
  pushStatus,
} from '@/lib/push'
import type { PushPermission } from '@/lib/push'
import { qk } from '@/lib/queryKeys'

/**
 * 브라우저 알림(웹 푸시).
 *
 * 앱이 켜져 있는 동안은 SSE 가 더 빠르므로, 이건 **앱을 꺼 둔 동안**을 위한 것이다.
 * 권한을 이미 허용한 사람은 앱을 열 때마다 토큰을 다시 등록한다 — 토큰은 브라우저가
 * 조용히 갱신하기 때문에, 한 번 보내고 마는 것으로는 부족하다.
 */
export function usePushNotifications(enabled: boolean) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [permission, setPermission] = useState<PushPermission>(() => pushPermission())
  const [busy, setBusy] = useState(false)

  const available = isPushConfigured() && isPushSupported()

  /*
   * 콘솔에서 `followupPushStatus()` 로 지금 상태를 볼 수 있게 해 둔다.
   * 푸시는 눈에 보이는 단계가 없어서, 막혔을 때 어디서 막혔는지 물어볼 방법이 필요하다.
   */
  useEffect(() => {
    ;(window as unknown as { followupPushStatus?: unknown }).followupPushStatus = pushStatus
  }, [])

  /*
   * 이미 허용해 둔 브라우저는 조용히 다시 등록한다.
   *
   * 앱을 열 때 한 번, 그리고 서비스워커가 새로 제어를 넘겨받을 때 한 번 더 한다.
   * 워커가 바뀌면 토큰도 바뀔 수 있어서, 앱 로드 때만 하면 그 사이가 빈다.
   */
  useEffect(() => {
    if (!enabled || !available || pushPermission() !== 'granted') return
    let cancelled = false
    const resubscribe = async () => {
      /*
       * 앱을 열 때마다 토큰을 다시 받아 서버에 등록한다.
       *
       * 서비스워커 등록이 사라지면(사용자가 해제했거나 브라우저가 정리했거나) 토큰이
       * 무효가 되고, 서버에 남아 있던 구독은 죽은 것이 된다. 권한이 이미 허용이면
       * "알림 켜기" 버튼도 보이지 않아 다시 켤 방법이 없다. 그래서 권한 상태와 무관하게
       * 여기서 매번 등록을 되살린다.
       */
      try {
        const token = await currentPushToken()
        if (!token) {
          // 토큰을 못 받으면 구독도 못 한다. 왜 못 받았는지는 위에서 이미 남겼다.
          return
        }
        if (cancelled) return
        await subscribePush(token)
      } catch (e) {
        // 등록·토큰·구독 어디서 막혀도 여기로 온다. 조용히 넘어가면 원인을 찾을 수 없다.
        console.warn('[FollowUp] 푸시 구독을 등록하지 못했습니다.', e)
        // 실패해도 알림은 SSE·폴링이 계속 받는다.
      }
    }

    void resubscribe()
    // 서비스워커가 교체되면 토큰이 달라질 수 있다.
    navigator.serviceWorker?.addEventListener('controllerchange', resubscribe)
    return () => {
      cancelled = true
      navigator.serviceWorker?.removeEventListener('controllerchange', resubscribe)
    }
  }, [enabled, available])

  // 앱이 켜져 있는 동안 도착한 푸시는 목록만 새로 고친다. (배너는 브라우저가 띄우지 않는다)
  useEffect(() => {
    if (!enabled || !available || permission !== 'granted') return
    let stop: (() => void) | undefined
    void onPushMessage(() => {
      void qc.invalidateQueries({ queryKey: qk.notifications })
    }).then((un) => {
      stop = un
    })
    return () => stop?.()
  }, [enabled, available, permission, qc])

  /*
   * 알림을 눌렀을 때 서비스워커가 보내는 이동 요청.
   * 서비스워커가 아직 이 탭을 제어하지 않으면 직접 이동시킬 수 없어서, 대신 경로를 넘겨 준다.
   */
  useEffect(() => {
    if (!available || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | null
      if (data?.type === 'followup:navigate' && data.path) navigate(data.path)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [available, navigate])

  /** 사용자가 직접 켤 때만 권한을 묻는다. 화면에 들어오자마자 묻지 않는다. */
  const turnOn = useCallback(async () => {
    setBusy(true)
    try {
      const token = await enablePush()
      setPermission(pushPermission())
      if (!token) return false
      await subscribePush(token)
      return true
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { available, permission, busy, turnOn }
}

/** 로그아웃할 때 이 브라우저의 구독을 지운다. 실패해도 로그아웃은 계속된다. */
export async function forgetPushSubscription() {
  if (!isPushConfigured() || !isPushSupported()) return
  try {
    const token = await currentPushToken()
    if (token) await unsubscribePush(token)
    const { deletePushToken } = await import('@/lib/push')
    await deletePushToken()
  } catch {
    // 지우지 못해도 로그아웃을 막지 않는다.
  }
}
