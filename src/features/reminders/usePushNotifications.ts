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

  // 이미 허용해 둔 브라우저는 조용히 다시 등록한다.
  useEffect(() => {
    if (!enabled || !available || pushPermission() !== 'granted') return
    let cancelled = false
    void (async () => {
      const token = await currentPushToken()
      if (!token || cancelled) return
      try {
        await subscribePush(token)
      } catch {
        // 백엔드에 아직 없거나 일시적인 실패 — 알림은 SSE·폴링이 계속 받는다.
      }
    })()
    return () => {
      cancelled = true
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
