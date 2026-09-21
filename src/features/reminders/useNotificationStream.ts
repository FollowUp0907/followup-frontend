import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getToken, isTokenExpired } from '@/lib/auth'
import { qk } from '@/lib/queryKeys'

/**
 * 알림 실시간 수신 (SSE).
 *
 * 백엔드: GET /api/notifications/stream  (text/event-stream)
 * 인증:   ?token=<JWT>  — EventSource 는 헤더를 못 실어서 쿼리로 보낸다.
 *         (2026-09-21 확인: token 만 받고 access_token 등 다른 이름은 안 읽는다)
 *
 * **Vercel 프록시를 거치지 않고 백엔드에 직접 붙는다.** 서버리스 함수는 요청/응답
 * 단위라 스트림을 그대로 흘려보내지 못하고, 본문을 모아 두었다가 한 번에 준다.
 * 일반 REST 호출은 지금처럼 프록시를 계속 쓴다 — 한 번에 다 바꾸면 위험이 커진다.
 *
 * 이벤트가 오면 목록을 다시 받는다. 본문을 신뢰해 화면에 직접 꽂지 않는 이유는,
 * 서버가 무엇을 싣든(알림 전체든 id 하나든) 같은 코드로 동작하게 하기 위해서다.
 */

/** 예: https://est-followup-api.duckdns.org — 비어 있으면 SSE 를 켜지 않는다. */
const SSE_ORIGIN = import.meta.env.VITE_SSE_ORIGIN ?? ''

/** 서버가 붙일 수 있는 이벤트 이름들. 이름 없이 보내면 message 로 온다. */
const EVENT_NAMES = ['notification', 'notifications', 'message']

export function useNotificationStream(enabled: boolean) {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !SSE_ORIGIN) return
    const token = getToken()
    if (!token || isTokenExpired(token)) return

    const url = `${SSE_ORIGIN}/api/notifications/stream?token=${encodeURIComponent(token)}`
    let es: EventSource | null = new EventSource(url)

    const refresh = () => {
      void qc.invalidateQueries({ queryKey: qk.notifications })
    }

    es.onopen = () => setConnected(true)
    for (const name of EVENT_NAMES) es.addEventListener(name, refresh)

    es.onerror = () => {
      // EventSource 는 스스로 다시 붙는다. 다만 완전히 닫힌 경우는 폴링으로 돌아가야 해서
      // 연결 상태만 내려 둔다. (토큰이 만료되면 서버가 401 로 끊고, 재접속도 계속 실패한다)
      setConnected(false)
      if (es?.readyState === EventSource.CLOSED) {
        es.close()
        es = null
      }
    }

    return () => {
      setConnected(false)
      for (const name of EVENT_NAMES) es?.removeEventListener(name, refresh)
      es?.close()
      es = null
    }
  }, [enabled, qc])

  return { connected, available: !!SSE_ORIGIN }
}
