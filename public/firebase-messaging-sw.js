/*
 * 웹 푸시 서비스워커 — 앱이 꺼져 있는 동안 알림을 받는다.
 *
 * 이 파일은 빌드를 거치지 않는 정적 파일이라 환경변수를 읽을 수 없다.
 * 그래서 등록할 때 주소에 설정값을 실어 보내고(src/lib/push.ts), 여기서 꺼내 쓴다.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

/*
 * 고친 내용이 바로 적용되게 한다.
 *
 * 서비스워커는 기본적으로 **열려 있는 탭이 모두 닫힐 때까지** 예전 버전이 계속 일한다.
 * 그래서 클릭 처리를 고쳐도 이전 서비스워커가 받아 아무 일도 일어나지 않았다.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/**
 * 알림에 붙어 온 data 를 꺼낸다.
 *
 * 백엔드가 notification 을 함께 보내면 브라우저가 배너를 자동으로 띄우는데,
 * 그때 payload 는 `notification.data.FCM_MSG.data` 안에 들어간다.
 * 우리가 직접 띄운 알림만 `notification.data` 에 그대로 있다.
 */
function readData(notification) {
  const raw = (notification && notification.data) || {}
  if (raw.FCM_MSG) return raw.FCM_MSG.data || raw.FCM_MSG.notification || {}
  if (raw.data) return raw.data
  return raw
}

/** 업무가 있으면 업무 화면, 프로젝트만 있으면 프로젝트 화면. (actionItemId 는 없으면 빈 문자열로 온다) */
function pathFor(data) {
  const projectId = data.projectId
  const actionItemId = data.actionItemId
  if (projectId && actionItemId) return '/projects/' + projectId + '/tasks/' + actionItemId
  if (projectId) return '/projects/' + projectId
  return '/projects'
}

/*
 * 알림 클릭 — **반드시 firebase.messaging() 보다 먼저 등록해야 한다.**
 *
 * FCM SDK 도 notificationclick 을 듣는데, 그 핸들러가 맨 처음 하는 일이
 * event.stopImmediatePropagation() 이다. 뒤에 등록된 리스너는 아예 호출되지 않는다.
 * 그러고는 fcm_options.link 가 없으면 아무 데도 가지 않고 끝난다 —
 * 알림은 떴는데 눌러도 반응이 없던 이유가 이것이었다.
 * 리스너는 등록한 순서대로 불리므로, 우리 것을 먼저 달아 두면 우리가 먼저 처리한다.
 */
self.addEventListener('notificationclick', (event) => {
  const data = readData(event.notification)
  const path = pathFor(data)
  const url = new URL(path, self.location.origin).href

  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        if ('focus' in client) await client.focus()
        try {
          // 서비스워커가 제어 중인 탭이면 그대로 이동시킨다.
          await client.navigate(url)
        } catch (e) {
          // 아직 제어하지 않는 탭은 새로고침 없이 앱에 맡긴다.
          client.postMessage({ type: 'followup:navigate', path: path })
        }
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})

const params = new URLSearchParams(self.location.search)
const config = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
}

if (config.apiKey && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config)
  const messaging = firebase.messaging()

  /*
   * 백그라운드 메시지.
   * 백엔드가 notification 을 함께 보내므로 브라우저가 배너를 알아서 띄운다.
   * 여기서 또 띄우면 두 번 뜨기 때문에, data 만 온 경우에만 직접 띄운다.
   */
  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return
    const data = payload.data || {}
    self.registration.showNotification(data.taskTitle || '새 알림', {
      body: data.taskTitle || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.notificationId || undefined,
      data: data,
    })
  })
}
