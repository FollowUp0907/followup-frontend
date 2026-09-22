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
 * 알림 권한을 받고 FCM 토큰을 가져온다.
 * 이미 거부한 사람에게는 다시 묻지 않는다 — 브라우저가 어차피 두 번은 묻지 않는다.
 */
export async function enablePush(): Promise<string | null> {
  if (!isPushConfigured() || !isPushSupported()) return null

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' })
  const m = await messaging()
  if (!m) return null

  return m.getToken(m.instance, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
}

/** 로그아웃할 때 이 브라우저의 토큰을 지운다. */
export async function currentPushToken(): Promise<string | null> {
  if (!isPushConfigured() || !isPushSupported() || Notification.permission !== 'granted') return null
  const registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) return null
  const m = await messaging()
  if (!m) return null
  try {
    return await m.getToken(m.instance, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  } catch {
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
