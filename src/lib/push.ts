/**
 * 웹 푸시 (Firebase Cloud Messaging).
 *
 * 앱이 켜져 있을 때는 SSE 가 더 빠르므로, 웹 푸시는 **앱을 꺼 둔 동안** 알림이 닿게 하는 용도다.
 * 브라우저가 알아서 포그라운드 메시지는 배너를 띄우지 않으므로 알림이 두 번 뜨지 않는다.
 *
 * 설정값이 비어 있으면 기능을 켜지 않는다. (구글 로그인과 같은 방식)
 */
import type { MessagePayload } from 'firebase/messaging'

const CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? ''

/** 서비스워커는 정적 파일이라 빌드 시점 값을 모른다. 그래서 주소에 실어 보낸다. */
const SW_URL = `/firebase-messaging-sw.js?${new URLSearchParams({
  apiKey: CONFIG.apiKey,
  authDomain: CONFIG.authDomain,
  projectId: CONFIG.projectId,
  messagingSenderId: CONFIG.messagingSenderId,
  appId: CONFIG.appId,
}).toString()}`

export function isPushConfigured() {
  return !!CONFIG.apiKey && !!CONFIG.messagingSenderId && !!CONFIG.appId && !!VAPID_KEY
}

/** 이 브라우저가 웹 푸시를 지원하는가 (사파리 iOS 는 홈 화면에 추가해야 동작한다) */
export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export function pushPermission(): PushPermission {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission as PushPermission
}

/*
 * SDK 는 실제로 켤 때만 불러온다. 200KB 가 넘어서 첫 화면에 얹을 이유가 없다.
 */
async function messaging() {
  const [{ initializeApp, getApps, getApp }, msg] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ])
  const app = getApps().length ? getApp() : initializeApp(CONFIG)
  if (!(await msg.isSupported())) return null
  return { ...msg, instance: msg.getMessaging(app) }
}

/**
 * 서비스워커 등록. 여러 번 불러도 안전하다 — 같은 스크립트면 기존 등록을 그대로 돌려준다.
 *
 * 등록을 "알림 켜기" 를 누를 때만 했던 적이 있는데, 그러면 등록이 풀린 뒤(직접 해제했거나
 * 브라우저가 정리했거나) 복구할 길이 없었다. 권한이 이미 허용이면 버튼도 안 보여서
 * 다시 누를 수도 없다. 그래서 토큰이 필요한 자리에서는 항상 여기를 거친다.
 */
async function ensureRegistration() {
  return navigator.serviceWorker.register(SW_URL, { scope: '/' })
}

/**
 * 알림 권한을 받고 FCM 토큰을 가져온다.
 * 이미 거부한 사람에게는 다시 묻지 않는다 — 브라우저가 어차피 두 번은 묻지 않는다.
 */
export async function enablePush(): Promise<string | null> {
  if (!isPushConfigured() || !isPushSupported()) return null

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await ensureRegistration()
  const m = await messaging()
  if (!m) return null

  return m.getToken(m.instance, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
}

/**
 * 지금 이 브라우저의 FCM 토큰. 권한이 이미 허용이면 묻지 않고 그대로 가져온다.
 *
 * 등록이 없으면 여기서 다시 등록한다. 토큰은 서비스워커 등록에 묶여 있어서,
 * 등록이 사라지면 토큰도 무효가 되고 서버에 남아 있던 구독은 죽은 것이 된다.
 * 앱을 열 때마다 이걸 부르고 서버에 다시 등록해야 그 구멍이 메워진다.
 */
export async function currentPushToken(): Promise<string | null> {
  if (!isPushConfigured() || !isPushSupported() || Notification.permission !== 'granted') return null
  const registration = await ensureRegistration()
  const m = await messaging()
  if (!m) return null
  try {
    return await m.getToken(m.instance, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  } catch (e) {
    // 조용히 실패하면 "구독이 없는데 아무도 모르는" 상태가 된다. 개발 중에는 알려 준다.
    if (import.meta.env.DEV) console.warn('[FollowUp] FCM 토큰을 가져오지 못했습니다.', e)
    return null
  }
}

export async function deletePushToken() {
  const m = await messaging()
  if (!m) return
  try {
    await m.deleteToken(m.instance)
  } catch {
    // 이미 없으면 그만이다.
  }
}

/**
 * 앱이 켜져 있는 동안 도착한 푸시.
 * 배너는 브라우저가 띄우지 않으므로, 알림 목록만 다시 불러오면 된다.
 */
export async function onPushMessage(handler: (payload: MessagePayload) => void) {
  if (!isPushConfigured() || !isPushSupported() || Notification.permission !== 'granted') return () => {}
  const m = await messaging()
  if (!m) return () => {}
  return m.onMessage(m.instance, handler)
}
